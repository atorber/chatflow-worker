/* eslint-disable sort-keys */
import { ChatFlowConfig } from '../db/vika-bot.js'

import { VikaSheet } from '../db/vika.js'
import { Message, ScanStatus, types } from 'wechaty'
import { getCurTime, delay, logger } from '../utils/utils.js'
import moment from 'moment'
import { FileBox } from 'file-box'

import { db } from '../db/tables.js'
const messageData = db.message

const MEDIA_PATH = 'data/media/image'

async function handleFileMessage (file:FileBox, db:VikaSheet, message: Message) {
  const fileName = file.name
  const room = message.room()
  const talker = message.talker()
  let filePath = `${MEDIA_PATH}/contact/${talker.id}_${fileName}`
  if (room) {
    filePath = `${MEDIA_PATH}/room/${room.id}_${fileName}`
  }

  // logger.info('文件路径filePath:', filePath)

  try {
    await file.toFile(filePath, true)
    logger.info('保存文件到本地成功')
  } catch (err) {
    logger.error('保存文件到本地失败', err)
    return ''
  }

  await delay(1000)
  return await db.upload(filePath, '')
}

// 服务类
export class MessageChat {

  private db:VikaSheet
  msgStore!: any[]
  messageData: any

  constructor () {
    this.db = new VikaSheet(ChatFlowConfig.vika, ChatFlowConfig.dataBaseIds.messageSheet)
    this.msgStore = []
    this.messageData = messageData
    void this.init()
  }

  // 初始化
  async init () {
    const that = this
    setInterval(() => {
      // logger.info('待处理消息池长度：', that.msgStore.length || '0')

      if (that.msgStore.length) {
        const end = that.msgStore.length < 10 ? that.msgStore.length : 10
        const records = that.msgStore.splice(0, end)
        // logger.info('写入vika的消息：', JSON.stringify(records))
        try {
          this.db.insert(records).then((response: { success: any }) => {
            if (!response.success) {
              logger.error('调用vika写入接口成功，写入vika失败：', JSON.stringify(response))
            }
            return response
          }).catch((err: any) => { logger.error('调用vika写入接口失败：', err) })
        } catch (err) {
          logger.error('调用datasheet.records.create失败：', err)
        }
      }
    }, 1000)
  }

  addRecord (record: any) {
    logger.info('消息入列:', JSON.stringify(record))
    if (record.fields) {
      this.msgStore.push(record)
      // logger.info('最新消息池长度：', this.msgStore.length)
    }
  }

  async addChatRecord (msg: Message, uploadedAttachments: any, msgType: any, text: string) {
    const talker = msg.talker()
    const listener = msg.listener()
    text = text || msg.text()
    const room = msg.room()
    let topic = ''
    if (room) {
      topic = await room.topic()
    }
    const curTime = getCurTime()
    const timeHms = moment(curTime).format('YYYY-MM-DD HH:mm:ss')
    const files: any = []
    let wxAvatar:any = ''
    let roomAvatar:any = ''
    let listenerAvatar:any = ''
    try {
      wxAvatar = (await talker.avatar()).toJSON()
      wxAvatar = wxAvatar.url
    } catch (e) {
      logger.error('获取发言人头像失败：', e)
    }

    if (listener) {
      try {
        listenerAvatar = (await listener.avatar()).toJSON()
        listenerAvatar = listenerAvatar.url
      } catch (e) {
        logger.error('获取发言人头像失败：', e)
      }
    }

    if (room) {
      try {
        roomAvatar = (await room.avatar()).toJSON()
        roomAvatar = roomAvatar.url
      } catch (e) {
        logger.error('获取发言人头像失败：', e)
      }
    }

    try {
      if (uploadedAttachments) {
        files.push(uploadedAttachments.data)
        // text = JSON.stringify(uploadedAttachments.data)
      }

      const record = {
        fields: {
          '时间|timeHms':timeHms,
          '发送者|name': talker.name(),
          '好友备注|alias': await talker.alias(),
          '群名称|topic': topic || '--',
          '消息内容|messagePayload': text,
          '好友ID|wxid': talker.id !== 'null' ? talker.id : '--',
          '群ID|roomid': room && room.id ? room.id : '--',
          '消息类型|messageType': msgType,
          '文件图片|file': files,
          '消息ID|messageId': msg.id,
          '接收人|listener': topic ? '--' : (await listener?.alias() || listener?.name()),
          '接收人ID|listenerid':topic ? '--' : listener?.id,
          '发送者头像|wxAvatar': wxAvatar,
          '群头像|roomAvatar':roomAvatar,
          '接收人头像|listenerAvatar':listenerAvatar,
        },
      }
      // logger.info('addChatRecord:', JSON.stringify(record))
      this.msgStore.push(record)
      // logger.info('最新消息池长度：', this.msgStore.length)
    } catch (e) {
      logger.error('添加记录失败：', e)

    }

  }

  async addScanRecord (uploadedAttachments: any, text: string) {

    const curTime = getCurTime()
    const timeHms = moment(curTime).format('YYYY-MM-DD HH:mm:ss')
    const files: any = []
    if (uploadedAttachments.data) {
      files.push(uploadedAttachments.data)
    }

    const records = [
      {
        fields: {
          '时间|timeHms':timeHms,
          '发送者|name': 'system',
          '群名称|topic': '--',
          '消息内容|messagePayload': text,
          '好友ID|wxid': 'system',
          '群ID|roomid': '--',
          '消息类型|messageType': 'qrcode',
          '文件图片|file': files,
        },
      },
    ]

    // logger.info('待写入登录二维码消息:', JSON.stringify(records))
    const response = await this.db.insert(records)
    if (!response.success) {
      logger.error('调用vika写入接口成功，写入vika失败：', JSON.stringify(response))
    }
    return response
  }

  async addHeartbeatRecord (text: string) {

    const curTime = getCurTime()
    const timeHms = moment(curTime).format('YYYY-MM-DD HH:mm:ss')
    const files: any = []

    const record = {
      fields: {
        '时间|timeHms':timeHms,
        '发送者|name': 'system',
        '群名称|topic': '--',
        '消息内容|messagePayload': text,
        '好友ID|wxid': 'system',
        '群ID|roomid': '--',
        '消息类型|messageType': 'heartbeat',
        '文件图片|file': files,
      },
    }
    logger.info('心跳消息:', JSON.stringify(record))
    this.msgStore.push(record)
  }

  async onMessage (message: Message) {
    const room = message.room()
    const talker = message.talker()
    try {

      let uploadedAttachments:any = ''
      const msgType = types.Message[message.type()]
      let file: any
      let text = ''

      let urlLink
      let miniProgram

      switch (message.type()) {
        // 文本消息
        case types.Message.Text:
          text = message.text()
          break

          // 图片消息

        case types.Message.Image:{

          const img = await message.toImage()
          await delay(1500)
          try {
            file = await img.hd()
            // file = await message.toFileBox()

          } catch (e) {
            logger.error('Image解析img.hd()失败：', e)
            try {
              file = await img.thumbnail()
            } catch (e) {
              logger.error('Image解析img.thumbnail()失败：', e)
            }
          }

          break
        }

        // 链接卡片消息
        case types.Message.Url:
          urlLink = await message.toUrlLink()
          text = JSON.stringify(JSON.parse(JSON.stringify(urlLink)).payload)
          // file = await message.toFileBox();
          break

        // 小程序卡片消息
        case types.Message.MiniProgram:

          miniProgram = await message.toMiniProgram()

          text = JSON.stringify(JSON.parse(JSON.stringify(miniProgram)).payload)

          // logger.info(miniProgram)
          /*
          miniProgram: 小程序卡片数据
          {
            appid: "wx363a...",
            description: "贝壳找房 - 真房源",
            title: "美国白宫，10室8厅9卫，99999刀/月",
            iconUrl: "http://mmbiz.qpic.cn/mmbiz_png/.../640?wx_fmt=png&wxfrom=200",
            pagePath: "pages/home/home.html...",
            shareId: "0_wx363afd5a1384b770_..._1615104758_0",
            thumbKey: "84db921169862291...",
            thumbUrl: "3051020100044a304802010002046296f57502033d14...",
            username: "gh_8a51...@app"
          }
         */
          break

        // 语音消息
        case types.Message.Audio:
          await delay(1500)
          try {
            file = await message.toFileBox()
          } catch (e) {
            logger.error('Audio解析失败：', e)
            file = ''
          }

          break

        // 视频消息
        case types.Message.Video:
          await delay(1500)
          try {
            file = await message.toFileBox()

          } catch (e) {
            logger.error('Video解析失败：', e)
            file = ''
          }
          break

        // 动图表情消息
        case types.Message.Emoticon:

          try {
            file = await message.toFileBox()

          } catch (e) {
            logger.error('Emoticon解析失败：', e)
            file = ''
          }

          break

        // 文件消息
        case types.Message.Attachment:
          await delay(1500)
          try {
            file = await message.toFileBox()

          } catch (e) {
            logger.error('Attachment解析失败：', e)
            file = ''
          }

          break
        // 文件消息
        case types.Message.Location:

          // const location = await message.toLocation()
          text = message.text()
          break
        case types.Message.Unknown:
          // const location = await message.toLocation()
          // text = JSON.stringify(JSON.parse(JSON.stringify(location)).payload)
          break
        // 其他消息
        default:
          break
      }

      if (file) {
        logger.info('文件file:', file)
        if (room) {
          text = `/room/${room.id}_${file.name}`
        } else {
          text = `/contact/${talker.id}_${file.name}`
        }
        uploadedAttachments = await handleFileMessage(file, this.db, message)
      }

      if (message.type() !== types.Message.Unknown) {
        await this.addChatRecord(message, uploadedAttachments, msgType, text)
      }

    } catch (e) {
      logger.error('onMessage消息转换失败：', e)
    }
  }

  async onScan (qrcode: string, status: ScanStatus) {
    if (status === ScanStatus.Waiting || status === ScanStatus.Timeout) {
      const qrcodeUrl = encodeURIComponent(qrcode)
      const qrcodeImageUrl = [
        'https://wechaty.js.org/qrcode/',
        qrcodeUrl,
      ].join('')
      // logger.info('StarterBot', 'vika onScan: %s(%s) - %s', ScanStatus[status], status, qrcodeImageUrl)

      let uploadedAttachments:any = ''
      let file: FileBox
      let filePath = ''
      try {
        file = FileBox.fromQRCode(qrcode)
        filePath = 'data/media/image/qrcode/' + file.name
        try {
          // const writeStream = fs.createWriteStream(filePath)
          // await file.pipe(writeStream)
          await file.toFile(filePath, true)
          await delay(1000)
          uploadedAttachments = await this.db.upload(filePath, '')
          const text = qrcodeImageUrl
          if (uploadedAttachments.data) {
            try {
              await this.addScanRecord(uploadedAttachments, text)
              // fs.unlink(filePath, (err) => {
              //   logger.info('二维码上传vika完成删除文件：', filePath, err)
              // })
            } catch (err) {
              logger.error('二维码vika 写入失败：', err)
            }
          }
        } catch {
          logger.info('二维码上传失败：', filePath)
          // fs.unlink(filePath, (err) => {
          //   logger.info('二维码上传vika失败删除文件', filePath, err)
          // })
        }

      } catch (e) {
        logger.error('onScan,二维码vika 写入失败：', e)
      }

    } else {
      logger.info('机器人启动，二维码上传维格表', 'onScan: %s(%s)', ScanStatus[status], status)
    }
  }

}
