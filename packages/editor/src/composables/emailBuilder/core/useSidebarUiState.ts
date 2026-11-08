// composables/emailBuilder/core/useSidebarUiState.ts
// Per-editor UI state for the left sidebar.
//
// Why this is not kept inside the tab components: the sidebar shows one tab at
// a time with v-if, at three nested levels (Content / Layout / General, then
// Styles / Tags / Visibility / ESP, then Merge Tag / Link Tag). v-if removes
// whatever is not showing, and a component's own refs go with it. The Merge Tag
// and Link Tag tabs hold things the user typed (tag names and preview values),
// so every tab switch used to wipe them.
//
// createEmailBuilderInstance() creates this once per editor and returns it as
// `sidebarUi`, next to the other preview state (mergeTagPreviewContext and
// friends). So two editors on one page do not share it, and it lasts as long as
// the editor does.
//
// It is deliberately not part of the template JSON. These values are sample
// data for previewing, not content, so they are not saved, exported or undone,
// and loading another template does not clear them.

import { reactive } from "vue";

/** One "tag -> preview value" row in the Merge Tag tab. */
export interface MergeTagEntry {
  tag: string;
  fallback: string;
  value: string;
}

/** One "tag -> preview value" row in the Link Tag tab. */
export interface LinkTagEntry {
  tag: string;
  value: string;
  default: string;
}

export interface SidebarUiState {
  // Which tab is open at each level. Plain strings, to match the `tabs`
  // arrays of the components that render them.
  leftTab: string;
  generalTab: string;
  tagsTab: string;

  mergeTags: {
    entries: MergeTagEntry[];
    showDetectedSummary: boolean;
    showSystemTags: boolean;
    showESPPreview: boolean;
  };
  linkTags: {
    entries: LinkTagEntry[];
    showDetectedSummary: boolean;
    showESPPreview: boolean;
  };
}

export const createSidebarUiState = (): SidebarUiState =>
  reactive<SidebarUiState>({
    leftTab: "Content",
    generalTab: "Styles",
    tagsTab: "Merge Tag",

    mergeTags: {
      entries: [],
      showDetectedSummary: true,
      showSystemTags: false,
      showESPPreview: true,
    },
    linkTags: {
      entries: [],
      showDetectedSummary: true,
      showESPPreview: true,
    },
  });
