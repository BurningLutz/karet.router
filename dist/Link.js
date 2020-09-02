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
  return /*#__PURE__*/React.createElement(GenericLink, {
    type: "a",
    to: to,
    href: to,
    onClick: U.actions(U.stopPropagation, U.preventDefault, () => push(aHistory, to)),
    ...rest
  });
}