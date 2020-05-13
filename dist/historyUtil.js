import * as U from "karet.util";
import * as R from "kefir.ramda";
import { curry } from "ramda";
import invariant from "invariant";
import { createBrowserHistory } from "history";
export const history = createBrowserHistory();
export const goBack = () => history.goBack();
export const reload = () => history.replace(history.location);
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