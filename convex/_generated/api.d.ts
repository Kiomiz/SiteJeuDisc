/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as answers from "../answers.js";
import type * as bluff from "../bluff.js";
import type * as familyfeud from "../familyfeud.js";
import type * as games from "../games.js";
import type * as justeprix from "../justeprix.js";
import type * as mostlikely from "../mostlikely.js";
import type * as petitbac from "../petitbac.js";
import type * as players from "../players.js";
import type * as questions from "../questions.js";
import type * as scores from "../scores.js";
import type * as sessions from "../sessions.js";
import type * as weeks from "../weeks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  answers: typeof answers;
  bluff: typeof bluff;
  familyfeud: typeof familyfeud;
  games: typeof games;
  justeprix: typeof justeprix;
  mostlikely: typeof mostlikely;
  petitbac: typeof petitbac;
  players: typeof players;
  questions: typeof questions;
  scores: typeof scores;
  sessions: typeof sessions;
  weeks: typeof weeks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
