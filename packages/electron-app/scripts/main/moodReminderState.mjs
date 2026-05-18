import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { showCornerNotificationWindow } from './cornerNotification.mjs'
import { state } from './state.mjs'

const REMINDER_TITLE = '灵伴 · 今日心情'
const REMINDER_BODY = '花一分钟记下今天的心情与日记吧。'

/** @type {null | {
 *   settingsReady: boolean
 *   onboardingComplete: boolean
 *   dailyMoodEnabled: boolean
 *   dailyMoodReminderEnabled: boolean
 *   dailyMoodReminderTime: string
 *   hasMoodEntryToday: boolean
 *   updatedAt: number
 * }} */
state.moodReminderSnapshot = null

function firedKeyPath() {
  return path.join(app.getPath('userData'), 'mood-reminder-last-fired.json')
}

function readPersistedFiredKey() {
  try {
    const raw = fs.readFileSync(firedKeyPath(), 'utf8')
    const parsed = JSON.parse(raw)
    return typeof parsed?.key === 'string' ? parsed.key : null
  } catch {
    return null
  }
}

function persistFiredKey(key) {
  try {
    fs.mkdirSync(path.dirname(firedKeyPath()), { recursive: true })
    fs.writeFileSync(firedKeyPath(), JSON.stringify({ key, at: Date.now() }))
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} hm
 */
function parseHm(hm) {
  const parts = String(hm ?? '').trim().split(':')
  if (parts.length < 2) return null
  const h = Number(parts[0])
  const m = Number(parts[1])
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return { h, m }
}

/**
 * @param {Date} d
 */
function minutesSinceMidnight(d) {
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * @param {{ h: number; m: number }} target
 */
function targetMinutes(target) {
  return target.h * 60 + target.m
}

/**
 * @param {Date} d
 */
function localDayKey(d) {
  const y = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${month}-${day}`
}

/**
 * @param {string} day
 * @param {string} reminderTime
 */
function firedKeyFor(day, reminderTime) {
  return `${day}@${String(reminderTime ?? '').trim()}`
}

/**
 * @param {typeof state.moodReminderSnapshot} snapshot
 */
export function updateMoodReminderSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return
  state.moodReminderSnapshot = {
    settingsReady: snapshot.settingsReady === true,
    onboardingComplete: snapshot.onboardingComplete === true,
    dailyMoodEnabled: snapshot.dailyMoodEnabled === true,
    dailyMoodReminderEnabled: snapshot.dailyMoodReminderEnabled === true,
    dailyMoodReminderTime: String(snapshot.dailyMoodReminderTime ?? '').trim(),
    hasMoodEntryToday: snapshot.hasMoodEntryToday === true,
    updatedAt: Date.now(),
  }
  setImmediate(() => {
    void evaluateMoodReminderFromMain()
  })
}

export async function evaluateMoodReminderFromMain() {
  const snapshot = state.moodReminderSnapshot
  if (!snapshot) return
  if (!snapshot.settingsReady) return
  if (!snapshot.onboardingComplete) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[sidekick] mood reminder skipped: onboarding not complete')
    }
    return
  }
  if (!snapshot.dailyMoodEnabled || !snapshot.dailyMoodReminderEnabled) return

  const target = parseHm(snapshot.dailyMoodReminderTime)
  if (!target) return

  const now = new Date()
  const day = localDayKey(now)
  const firedKey = firedKeyFor(day, snapshot.dailyMoodReminderTime)
  const lastFired = readPersistedFiredKey()
  if (lastFired === firedKey) return
  if (minutesSinceMidnight(now) < targetMinutes(target)) return

  if (snapshot.hasMoodEntryToday) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[sidekick] mood reminder skipped: mood entry exists for today')
    }
    persistFiredKey(firedKey)
    return
  }

  try {
    const ok = await showCornerNotificationWindow({
      title: REMINDER_TITLE,
      body: REMINDER_BODY,
      panel: 'emotion',
      emotionTab: 'summary',
    })
    if (ok) {
      persistFiredKey(firedKey)
      console.info('[sidekick] mood reminder shown', firedKey)
    } else {
      console.warn('[sidekick] mood reminder show returned false', firedKey)
    }
  } catch (err) {
    console.warn('[sidekick] mood reminder show failed', err)
  }
}
