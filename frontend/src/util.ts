import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

export const today = () => dayjs().format('YYYY-MM-DD')

export const formatDate = (date: string) => dayjs(date).format('ddd, D MMM YYYY')

/** Server timestamps are UTC "YYYY-MM-DD HH:mm:ss". */
export const formatDateTime = (value: string) => dayjs.utc(value).local().format('D MMM YYYY, HH:mm')
