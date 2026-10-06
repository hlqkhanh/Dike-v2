#!/bin/sh
# Prefer the optional per-user Windows toolchain over stale global shims.
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    if [ -n "${LOCALAPPDATA:-}" ]; then
      dike_node="$(cygpath -u "$LOCALAPPDATA")/Dike/toolchains/node-v24.21.0-win-x64"
      if [ -x "$dike_node/node.exe" ]; then
        PATH="$dike_node:$PATH"
        export PATH
      fi
    fi
    ;;
esac
node -e 'if(process.versions.node !== "24.21.0") { console.error("Dike requires Node 24.21.0. Restart your Git client after configuring the toolchain."); process.exit(1); }'

