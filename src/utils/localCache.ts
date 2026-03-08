/**
 * Local cache for MeasurementRecord (AsyncStorage).
 * Used as a fallback when the backend is unavailable (e.g., USE_MOCK_MEASUREMENT=true).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {MeasurementRecord} from '../types/measurement';

const CACHE_KEY = '@ppg_local_records';
const MAX_RECORDS = 200;

export async function saveLocalRecord(record: MeasurementRecord): Promise<void> {
  try {
    const existing = await getLocalRecords();
    // Prepend new record, deduplicate by id, keep newest MAX_RECORDS
    const updated = [record, ...existing.filter(r => r.id !== record.id)].slice(0, MAX_RECORDS);
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('[localCache] saveLocalRecord failed:', e);
  }
}

export async function getLocalRecords(): Promise<MeasurementRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MeasurementRecord[];
  } catch {
    return [];
  }
}

export async function clearLocalCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch (e) {
    console.warn('[localCache] clearLocalCache failed:', e);
  }
}
