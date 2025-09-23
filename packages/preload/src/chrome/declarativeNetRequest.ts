export type HeaderOperation = "append" | "set" | "remove";
export type ResourceType =
  | "main_frame"
  | "sub_frame"
  | "stylesheet"
  | "script"
  | "image"
  | "font"
  | "xmlhttprequest"
  | "media"
  | "websocket"
  | "other";

export type RuleActionType =
  | "block"
  | "redirect"
  | "allow"
  | "upgradeScheme"
  | "modifyHeaders";

export type Rule = {
  id: number;
  priority?: number;
  action: { type: RuleActionType; [key: string]: unknown };
  condition: {
    urlFilter?: string;
    resourceTypes?: ResourceType[];
    [key: string]: unknown;
  };
};

export type UpdateRuleOptions = {
  addRules?: Rule[];
  removeRuleIds?: number[];
};

export const declarativeNetRequest = {
  getDynamicRules(callback: (rules: Rule[]) => void) {
    callback([]);
  },
  getSessionRules(callback: (rules: Rule[]) => void) {
    callback([]);
  },
  updateDynamicRules(options: UpdateRuleOptions, callback?: () => void) {
    if (typeof callback === "function") callback();
  },
  updateSessionRules(options: UpdateRuleOptions, callback?: () => void) {
    if (typeof callback === "function") callback();
  },
};
