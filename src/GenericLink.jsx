import * as React from "karet"
import { useContext } from "karet"
import * as U from "karet.util"
import * as R from "kefir.ramda"
import invariant from "invariant"
import { pathToRegexp } from "path-to-regexp"

import { RouterContext } from "./common"

export default function GenericLink({
  type : T,

  to,
  exact = false,

  activeClassName,
  pendingClassName,
  className,
  activeStyle,

  ...rest
}) {
  const aHistory = useContext(RouterContext)
  invariant(aHistory, "The Link should be used inside a Router.")

  const { currentPath, next } = U.destructure(aHistory)

  const regexp = pathToRegexp(to.replace(/\?/g, "\\?"), undefined, { end: exact })

  const isActive  = U.thru(currentPath,
    U.mapValue(path => regexp.test(path)),
  )
  const isPending = U.thru(next,
    R.ifElse(R.isNil,
      R.always(false),
      R.pipe(
        U.mapValue(({ pathname, search, hash }) => pathname + search + hash),
        U.mapValue(path => regexp.test(path)),
      )
    ),
  )

  return (
    <T
      karet-lift

      style     = {U.when(isActive, activeStyle)}
      className = {U.cns(
        className,
        U.when(isActive, activeClassName),
        U.when(isPending, pendingClassName),
      )}

      {...rest}
    />
  )
}
