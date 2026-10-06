#!/bin/sh
# Resolve an explicit per-checkout toolchain before the Git client's inherited PATH.
# Embedded Git clients may omit cygpath. Never put a Windows drive colon into
# POSIX PATH: it would split C:\Users\... into two unrelated directories.
dike_posix_path() {
  # Git GUI shells may lack sed/cygpath. The existing Node is sufficient for
  # path normalization; only the selected runtime must meet the version gate.
  node -e 'let p=process.argv[1].trim().replace(/\\/g,"/"); p=p.replace(/^([A-Za-z]):\//,(_,d)=>"/"+d.toLowerCase()+"/"); process.stdout.write(p)' "$1"
}
dike_node="$(git config --local --get dike.nodePath || true)"
if [ -n "$dike_node" ]; then
  dike_node="$(dike_posix_path "$dike_node")"
  PATH="$dike_node:$PATH"
  export PATH
else
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*)
      dike_local="${LOCALAPPDATA:-${USERPROFILE:-$HOME}/AppData/Local}"
      dike_local="$(dike_posix_path "$dike_local")"
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
