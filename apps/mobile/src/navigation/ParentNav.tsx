// Parent-named aliases for the shared shell navigation (see shellNav.tsx). Kept
// so the parent screens/ParentShell read naturally; the kid shell uses the
// generic names directly.
export {
  ShellNavContext as ParentSplitNavContext,
  useShellNav as useParentNav,
  useShellParams as useParentParams,
  type ShellNav as ParentNav,
} from './shellNav';
