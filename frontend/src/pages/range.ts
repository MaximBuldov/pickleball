import dayjs, { type Dayjs } from 'dayjs'
import type { DateRange } from '../api'

/** Converts between the API's { from, to } strings and antd RangePicker values. */
export const rangeValue = (r: DateRange): [Dayjs, Dayjs] | null => (r.from && r.to ? [dayjs(r.from), dayjs(r.to)] : null)

export const toRange = (v: [Dayjs | null, Dayjs | null] | null): DateRange =>
  v?.[0] && v[1] ? { from: v[0].format('YYYY-MM-DD'), to: v[1].format('YYYY-MM-DD') } : {}
