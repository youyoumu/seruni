// preload/chrome/action.ts
type BadgeBackgroundColorDetails = {
  color: string | [number, number, number, number];
};
type BadgeTextDetails = { text: string };
type TitleDetails = { title: string };

export const action = {
  setBadgeBackgroundColor(
    details: BadgeBackgroundColorDetails,
    callback?: () => void,
  ) {
    if (typeof callback === "function") callback();
  },

  setBadgeText(details: BadgeTextDetails, callback?: () => void) {
    if (typeof callback === "function") callback();
  },

  setTitle(details: TitleDetails, callback?: () => void) {
    if (typeof callback === "function") callback();
  },
};
