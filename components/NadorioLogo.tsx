export default function NadorioLogo({compact=false}:{compact?:boolean}){
 return <div className={'nadorioLogo '+(compact?'compact':'')} aria-label="NADORIO">
  <span className="cxMark"><i></i><b></b></span>{!compact&&<span><strong>NADORIO</strong><small>CLUB MANAGEMENT PLATFORM</small></span>}
 </div>
}
