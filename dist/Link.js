function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

import * as React from "karet";
import { useContext } from "karet";
import * as U from "karet.util";
import invariant from "invariant";
import GenericLink from "./GenericLink";
import { RouterContext } from "./common";
import { push } from "./historyUtil";
export default function Link({
  to,
  ...rest
}) {
  const aHistory = useContext(RouterContext);
  invariant(aHistory, "The Link should be used inside a Router.");
  return React.createElement(GenericLink, _extends({
    type: "a",
    to: to,
    href: to,
    onClick: U.actions(U.stopPropagation, U.preventDefault, () => push(aHistory, to))
  }, rest));
}