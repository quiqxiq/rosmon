// Inactive endpoint returns the same shape as `/hotspot/users` (a list of
// HotspotUserRecord that simply have no live session). Re-export the
// users schema so consumers can import either location consistently and
// schema migration only happens in one place.
export {
  HotspotUserRecordSchema as InactiveUserRecordSchema,
  type HotspotUserRecord as InactiveUserRecord,
} from '../../users/api/schema'
