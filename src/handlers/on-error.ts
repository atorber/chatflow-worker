import { log } from 'wechaty'

async function onError (error:any) {
  log.error('捕捉到🐛，如果还能正常运行，可以忽略', error)
}
export default onError
