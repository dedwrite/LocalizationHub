import { site } from '../config/site'

export default function Brand() {
  return <><img src="/brand-primary.svg" width="28" height="28" alt="" style={{ flexShrink: 0 }} /><span dir="ltr">{site.name.slice(0, -3)}<span style={{ color: '#bafa61' }}>{site.name.slice(-3)}</span></span></>
}
