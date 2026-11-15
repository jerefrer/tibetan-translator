// Imported first by main.js, for its side effect: App.vue writes defaults
// (autoFillWords...) into Storage while it is being imported, and anything
// recorded after that could not tell a returning user from a new one.
import { recordReturningUser } from "./services/new-look";

recordReturningUser();
