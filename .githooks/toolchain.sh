#!/bin/sh
# Resolve an explicit per-checkout toolchain before the Git client's inherited PATH.
dike_node="$(git config --local --get dike.nodePath || true)"
if [ -n "$dike_node" ]; then
  if command -v cygpath >/dev/null 2>&1; then
    dike_node="$(cygpath -u "$dike_node")"
  fi
  PATH="$dike_node:$PATH"
  export PATH
else
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*)
      dike_local="${LOCALAPPDATA:-${USERPROFILE:-$HOME}/AppData/Local}"
      if command -v cygpath >/dev/null 2>&1; then
        dike_local="$(cygpath -u "$dike_local")"
      fi
      dike_node="$dike_local/Dike/toolchains/node-v24.21.0-win-x64"
      if [ -x "$dike_node/node.exe" ]; then
        PATH="$dike_node:$PATH"
        export PATH
      fi
      ;;
  esac
fi
hash -r 2>/dev/null || true
node -e 'if(process.versions.node !== "24.21.0") { console.error("Dike requires Node 24.21.0; found " + process.versions.node + " at " + process.execPath + ". Configure git config --local dike.nodePath with the directory containing Node 24.21.0, or run pnpm setup:repo using that Node version."); process.exit(1); }'
