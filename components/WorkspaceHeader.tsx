'use client';import {useParams} from 'next/navigation';
export default function WorkspaceHeader({title,subtitle}:{title:string;subtitle?:string}){useParams();return <div className="top"><div><div className="eyebrow cyan">CLUB MANAGEMENT</div><h1>{title}</h1>{subtitle&&<div className="muted">{subtitle}</div>}</div></div>}
