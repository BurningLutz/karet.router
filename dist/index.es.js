import * as React from "karet";
import { Fragment, useContext } from "karet";
import * as U from "karet.util";
import * as R from "kefir.ramda";
import { createBrowserHistory } from "history";
import invariant from "invariant";
import { pathToRegexp } from "path-to-regexp";
const RouterContext = React.createContext();
const history = createBrowserHistory();
export const push = R.curry((rwHistory, to) => {
  const {
    next
  } = U.destructure(rwHistory);
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
  const rwHistory = useContext(RouterContext);
  invariant(rwHistory, "The Link should be used inside a Router.");
  const {
    currentPath,
    next
  } = U.destructure(rwHistory);
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
    onClick: U.actions(U.stopPropagation, U.preventDefault, () => push(rwHistory, to))
  }, children);
}
const emptyLoader = R.always(Promise.resolve());
const findFirstMatchedRoute = U.lift(path => R.find(({
  regexp
}) => regexp.test(path)));
export function Router({
  routes,
  ParentComponent,
  rwHistory = U.atom()
}) {
  // inject transformed paths
  routes = U.thru(routes, R.map(route => {
    const keys = [];
    const regexp = pathToRegexp(route.path, keys, {
      end: false
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
  } = U.destructure(rwHistory);
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
  }); // treat the first load as a POP

  next.set({ ...R.pick(["pathname", "search", "hash"], history.location),
    type: "POP"
  });
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
    const element = U.thru(route, R.ifElse(R.propSatisfies(R.isNil, "Component"), R.always(null), ({
      Component
    }) => React.createElement(Component, props)));
    const nowrap = R.isNil(ParentComponent) || R.propEq("noParent", true, route);
    return U.thru(element, R.ifElse(R.always(nowrap), R.identity, () => React.createElement(ParentComponent, null, element)));
  }));
  return React.createElement(RouterContext.Provider, {
    value: rwHistory
  }, React.createElement(Fragment, null, U.onUnmount(unlisten), updatePath), React.createElement(Fragment, null, renderedElement));
}
