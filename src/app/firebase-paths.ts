import { collection, collectionGroup, doc } from "firebase/firestore";
import { db } from "./firebase";

export function usersCollection() {
  return collection(db, "settings", "users", "items");
}

export function userDoc(userId: string) {
  return doc(db, "settings", "users", "items", userId);
}

export function teamsCollection() {
  return collection(db, "settings", "teams", "items");
}

export function teamDoc(teamId: string) {
  return doc(db, "settings", "teams", "items", teamId);
}

export function scheduleRulesCollection() {
  return collection(db, "settings", "scheduleRules", "items");
}

export function scheduleRuleDoc(ruleId: string) {
  return doc(db, "settings", "scheduleRules", "items", ruleId);
}

export function publicHolidaysCollection() {
  return collection(db, "settings", "publicHolidays", "items");
}

export function publicHolidayDoc(holidayId: string) {
  return doc(db, "settings", "publicHolidays", "items", holidayId);
}

export function rhExportTemplatesDoc() {
  return doc(db, "settings", "rhExportTemplates");
}

export function rhCompensationRulesDoc() {
  return doc(db, "settings", "rhCompensationRules");
}

export function regularOnCallPeriodsCollection() {
  return collection(db, "regularOnCallPeriods");
}

export function regularOnCallPeriodDoc(periodId: string) {
  return doc(db, "regularOnCallPeriods", periodId);
}

export function regularInterventionsCollection(periodId: string) {
  return collection(db, "regularOnCallPeriods", periodId, "interventions");
}

export function regularInterventionDoc(periodId: string, interventionId: string) {
  return doc(db, "regularOnCallPeriods", periodId, "interventions", interventionId);
}

export function regularInterventionsGroup() {
  return collectionGroup(db, "interventions");
}
