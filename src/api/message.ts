import type {
  Message,
  // log,
} from 'wechaty'

import { db } from '../db/tables.js'
import { formatTimestamp, getCurrentTime } from '../utils/utils.js'
const messageData = db.message

export const formatMessage = async (message: Message) => {
  const talker = message.talker()
  const listener = message.listener()
  const room = message.room()
  let roomJson:any
  if (room) {
    roomJson = JSON.parse(JSON.stringify(room))
    delete roomJson.payload.memberIdList
  }
  const timestamp = message.payload?.timestamp ? (message.payload.timestamp * 1000) : new Date().getTime()
  const messageNew = {
    _id: message.id,
    data: message,
    listener:listener ?? undefined,
    room:roomJson,
    talker,
    time:getCurrentTime(timestamp),
    timestamp,
  }
  return messageNew
}

export const addMessage = async (message: Message) => {
  const talker = message.talker()
  const listener = message.listener()
  const room = message.room()
  let roomJson:any
  if (room) {
    roomJson = JSON.parse(JSON.stringify(room))
    delete roomJson.payload.memberIdList
  }
  const timestamp = message.payload?.timestamp ? (message.payload.timestamp * 1000) : new Date().getTime()
  const messageNew = {
    _id: message.id,
    data: message,
    listener:listener ?? undefined,
    room:roomJson,
    talker,
    time:formatTimestamp(timestamp)[5],
    timestamp,
  }
  // log.info('addMessage messageNew:', JSON.stringify(messageNew))
  try {
    await messageData.insert(messageNew)
    // log.info('消息写入数据库成功:', res._id)
    return true
  } catch (e) {
    // log.error('消息写入数据库失败:\n', e)
    return false
  }

}
