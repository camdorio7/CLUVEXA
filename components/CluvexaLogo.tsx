export default function CluvexaLogo({compact=false}:{compact?:boolean}){
 return <div className={'cluvexaLogo '+(compact?'compact':'')} aria-label="CLUVEXA">
  <span className="cxMark"><i></i><b></b></span>{!compact&&<span><strong>CLUVEXA</strong><small>CLUB MANAGEMENT PLATFORM</small></span>}
 </div>
}
