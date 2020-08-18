import * as React from "karet";
import { Fragment } from "karet";
import { useEffect } from "react";
import * as U from "karet.util";
import * as R from "kefir.ramda";
import { pathToRegexp } from "path-to-regexp";
import { push, history } from "./historyUtil";
import { RouterContext } from "./common";
const voidPromise = new Promise(R.identity);
const emptyLoader = R.always(Promise.resolve());
const emptyGetTitle = R.always(Promise.resolve());

const matchedRoute = path => R.find(({
  regexp
}) => regexp.test(path));

const SCROLLS = new WeakMap();

function ScrollRestoration({
  type,
  children
}) {
  function restoreScroll() {
    const currLoc = history.location;

    function update() {
      const scrollY = SCROLLS.get(currLoc);
      window.scrollTo({
        top: scrollY
      });

      if (window.scrollY !== scrollY) {
        requestAnimationFrame(update);
      }
    }

    if (type === "POP" && SCROLLS.has(currLoc)) {
      console.log(type, currLoc); // wait for all nodes to be rendered

      requestAnimationFrame(update);
    }
  }

  useEffect(restoreScroll, [type, children]);
  return React.createElement(Fragment, null, children);
}

export default function Router({
  aHistory = U.atom(),
  routes,
  fallback,
  parent
}) {
  // inject transformed paths
  routes = U.thru(routes, // append a redirect route if fallback is provided
  U.ifElse(R.isNil(fallback), R.identity, R.append({
    path: "",
    loader: async () => {
      push(aHistory, fallback);
      return voidPromise;
    }
  })), R.map(route => {
    const keys = [];
    const regexp = pathToRegexp(route.path + "(/|[?#].*)?", keys, {
      strict: true
    });
    return {
      keys,
      regexp,
      ...route
    };
  }));
  const originalTitle = document.title;
  const aTitle = U.atom();
  const updateTitle = U.consume((title = originalTitle) => document.title = title, aTitle);
  const {
    prevData,
    currData,
    next
  } = U.destructure(aHistory);
  const unlisten = history.listen(({
    pathname,
    search,
    hash
  }, type) => {
    // POP means user clicked the back to forward button of browser
    // REPLACE is typically triggered by a `reload`
    if (type === "POP" || type === "REPLACE") {
      next.set({
        pathname,
        search,
        hash,
        type
      });
    }
  }); // set init next when not provided at the time this component get mounted

  const syncWithHistory = U.thru(next, U.takeFirst(1), U.consume(R.when(R.isNil, () => {
    // treat the first load as a POP
    next.set({ ...R.pick(["pathname", "search", "hash"], history.location),
      type: "POP"
    });
  })));
  const preloadNext = U.thru(next, U.skipWhen(R.isNil), U.flatMapLatest(({
    pathname,
    search,
    hash,
    type
  }) => U.fromPromise(async () => {
    const searchParams = U.thru(new URLSearchParams(search), Array.from, R.fromPairs);
    const {
      loader = emptyLoader,
      getTitle = emptyGetTitle,
      pathParams = {}
    } = U.thru(routes, matchedRoute(pathname), R.ifElse(R.isNil, R.always({}), ({
      keys,
      regexp,
      ...rest
    }) => ({
      pathParams: U.thru(regexp.exec(pathname), R.drop(1), R.zip(keys), R.map(([{
        name
      }, val]) => [name, val]), R.fromPairs),
      ...rest
    })));
    const params = R.mergeAll([pathParams, searchParams]);
    const props = await loader(params, hash);
    const title = await getTitle(props, params, hash);
    return {
      path: pathname + search + hash,
      props,
      type,
      title
    };
  })));
  const updateCurrData = U.thru(preloadNext, U.consume(async ({
    path,
    props,
    type,
    title
  }) => {
    // always save scroll position when scrolling
    const currLoc = history.location;

    window.onscroll = function () {
      // at the end of transitioning, the key will be changed, and at that time
      // scrollY will be set to zero which should be ignored
      if (history.location === currLoc) {
        SCROLLS.set(currLoc, window.scrollY);
      }
    };

    U.holding(() => {
      currData.set({
        path,
        props,
        type
      });
      next.remove();
    });

    if (type === "PUSH") {
      history.push(path);
    }

    if (!R.isNil(title)) {
      aTitle.set(title);
    } else {
      aTitle.remove();
    }
  }));
  const updatePrevData = U.thru(currData, U.consume(data => prevData.set(data)));
  const renderedElement = U.thru(currData, U.skipWhen(R.isNil), U.mapValue(({
    path,
    props,
    type
  }) => {
    const route = matchedRoute(path)(routes) || {};
    const nowrap = R.isNil(parent) || R.propEq("noParent", true, route);
    return U.thru(route, R.ifElse(R.propSatisfies(R.isNil, "type"), R.always(null), R.pipe(({
      type: T
    }) => React.createElement(ScrollRestoration, {
      type: type
    }, React.createElement(T, props), updatePrevData), R.ifElse(R.always(nowrap), R.identity, element => React.createElement(parent, null, element)))));
  }));
  return React.createElement(RouterContext.Provider, {
    value: aHistory
  }, React.createElement(Fragment, null, U.onUnmount(unlisten), syncWithHistory, updateCurrData, updateTitle), React.createElement(Fragment, null, renderedElement));
}