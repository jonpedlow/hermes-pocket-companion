const palette = ['#c37a66','#8aade4','#a58bd5','#61bfae','#c49b55','#d17f9e','#90b76a']
export function fallbackAccent(profile: string) {
  let hash=0
  for (const c of profile) hash=(31*hash+c.charCodeAt(0))>>>0
  return palette[hash%palette.length]
}
export function accentInk(hex: string) {
  const rgb = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255)
    .map(x => x<=0.04045 ? x/12.92 : ((x+0.055)/1.055)**2.4)
  const luminance=rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722
  return (luminance+0.05)/0.05 >= 1.05/(luminance+0.05) ? '#000000' : '#ffffff'
}

export function avatarAccent(img: HTMLImageElement) {
  const canvas=document.createElement('canvas')
  canvas.width=canvas.height=32
  const ctx=canvas.getContext('2d')
  if (!ctx) return
  ctx.drawImage(img,0,0,32,32)
  const bytes=ctx.getImageData(0,0,32,32).data
  const bins=new Map<number,{count:number;r:number;g:number;b:number}>()
  for (let i=0;i<bytes.length;i+=4) {
    const [r,g,b,a]=bytes.subarray(i,i+4)
    if (a<180 || Math.max(r,g,b)-Math.min(r,g,b)<32) continue
    const bucket=(r>>5)*64+(g>>5)*8+(b>>5)
    const bin=bins.get(bucket) || {count:0,r:0,g:0,b:0}
    bin.count++;bin.r+=r;bin.g+=g;bin.b+=b
    bins.set(bucket,bin)
  }
  const best=[...bins.values()].sort((a,b)=>b.count-a.count)[0]
  if (!best || best.count<8) return
  return '#'+[best.r,best.g,best.b].map(sum=>Math.round(sum/best.count).toString(16).padStart(2,'0')).join('')
}

export const fontSizes={Normal:16,Large:19,'Extra Large':22}
export type FontSize=keyof typeof fontSizes
export function savedFontSize():FontSize {
  const stored=localStorage.getItem('pocket-font-size')
  return stored==='Large' || stored==='Extra Large' ? stored : 'Normal'
}
