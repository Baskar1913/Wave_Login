import {Icon} from './Icon';
export function Toast({message,type='success',onClose}:{message:string,type?:'success'|'error',onClose:()=>void}){return <div className={`toast ${type}`}><Icon name={type==='success'?'check':'x'} size={17}/><span>{message}</span><button onClick={onClose}>×</button></div>}
