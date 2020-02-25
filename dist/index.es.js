import * as React from "karet";
import { Fragment, useContext } from "karet";
import * as U from "karet.util";
import * as R from "kefir.ramda";
import { curry } from "ramda";
import { createBrowserHistory } from "history";
import invariant from "invariant";
import { pathToRegexp } from "path-to-regexp";

function randomString(length) {
  const chars = "0123456789abcdef";
  return U.thru(R.times(() => chars[Math.floor(Math.random() * chars.length)], length), R.join(""));
}

const RouterContext = React.createContext();
const history = createBrowserHistory();
export const push = curry((aHistory, to) => {
  const {
    next
  } = U.destructure(aHistory);
  const url = new URL(to, window.location.href); // the origin should be the same if `to` is a relative path, and History API
  // only support relative path securely.

  invariant(url.origin === window.location.origin, "The `to` property should be a relative path.");
  next.set({ ...R.pick(["pathname", "search", "hash"], url),
    type: "PUSH"
  });
});
export const goBack = () => history.goBack();
export function Link({
  to,
  activeClassName,
  pendingClassName,
  className,
  activeStyle,
  children
}) {
  const aHistory = useContext(RouterContext);
  invariant(aHistory, "The Link should be used inside a Router.");
  const {
    currentPath,
    next
  } = U.destructure(aHistory);
  const regexp = pathToRegexp(to.replace(/\?/g, "\\?"), undefined, {
    end: false
  });
  const isActive = U.thru(currentPath, U.mapValue(path => regexp.test(path)));
  const isPending = U.thru(next, R.ifElse(R.isNil, R.always(false), R.pipe(U.mapValue(({
    pathname,
    search,
    hash
  }) => pathname + search + hash), U.mapValue(path => regexp.test(path)))));
  return React.createElement("a", {
    href: to,
    style: U.when(isActive, activeStyle),
    className: U.cns(className, U.when(isActive, activeClassName), U.when(isPending, pendingClassName)),
    onClick: U.actions(U.stopPropagation, U.preventDefault, () => push(aHistory, to))
  }, children);
}
const emptyLoader = R.always(Promise.resolve());
const findFirstMatchedRoute = U.lift(path => R.find(({
  regexp
}) => regexp.test(path)));
export function Router({
  routes,
  parent,
  aHistory = U.atom()
}) {
  // inject transformed paths
  routes = U.thru(routes, R.map(route => {
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
  const {
    currentPath,
    currentProps,
    next
  } = U.destructure(aHistory);
  const unlisten = history.listen(({
    pathname,
    search,
    hash
  }, type) => {
    // POP means user clicked the back to forward button of browser
    if (type === "POP") {
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
  const prepareWhenNextChanged = U.thru(next, U.skipWhen(R.isNil), U.flatMapLatest(({
    pathname,
    search,
    hash,
    type
  }) => U.fromPromise(async () => {
    const searchParams = U.thru(new URLSearchParams(search), Array.from, R.fromPairs);
    const {
      loader = emptyLoader,
      pathParams = {}
    } = U.thru(routes, findFirstMatchedRoute(pathname), R.ifElse(R.isNil, R.always({}), ({
      keys,
      regexp,
      loader
    }) => ({
      loader,
      pathParams: U.thru(regexp.exec(pathname), R.drop(1), R.zip(keys), R.map(([{
        name
      }, val]) => [name, val]), R.fromPairs)
    })));
    const params = R.mergeAll([pathParams, searchParams]);
    const props = await loader(params, hash);
    return {
      path: pathname + search + hash,
      props,
      type
    };
  })));
  const updatePath = U.thru(prepareWhenNextChanged, U.consume(async ({
    path,
    props,
    type
  }) => {
    U.holding(() => {
      currentPath.set(path);
      currentProps.set(props);
      next.remove();
    });

    if (type === "PUSH") {
      history.push(path);
    }
  }));
  const currentRoute = U.thru(routes, findFirstMatchedRoute(U.skipWhen(R.isNil, currentPath)));
  const renderedElement = U.thru(U.template([currentRoute, currentProps]), // this is a trick to workaround the issue that kefir has no simultaneous event support
  U.debounce(0), U.mapValue(([route = {}, props]) => {
    const nowrap = R.isNil(parent) || R.propEq("noParent", true, route);
    return U.thru(route, R.ifElse(R.propSatisfies(R.isNil, "type"), R.always(null), R.pipe(({
      type
    }) => React.createElement(type, {
      key: randomString(8),
      ...props
    }), R.ifElse(R.always(nowrap), R.identity, element => React.createElement(parent, null, element)))));
  }));
  return React.createElement(RouterContext.Provider, {
    value: aHistory
  }, React.createElement(Fragment, null, U.onUnmount(unlisten), updatePath, syncWithHistory), React.createElement(Fragment, null, renderedElement));
}
