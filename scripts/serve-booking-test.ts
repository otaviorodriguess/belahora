import { createServer } from 'vite';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import agenda from '../api/agenda';
import { createBookingHandler } from '../api/booking';
if(process.env.GCLOUD_PROJECT!=='demo-belahora'||process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'||process.env.VERCEL)throw new Error('Local demo only');
const booking=createBookingHandler(async req=>{if(req.headers['x-firebase-appcheck']!=='test-proof')throw new Error('Test proof missing');});
const server=await createServer({server:{host:'localhost',port:4181,strictPort:true},plugins:[{name:'local-api-harness',configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
 const url=new URL(req.url||'/','http://localhost');if(!['/api/agenda','/api/booking'].includes(url.pathname))return next();
 let body='';for await(const chunk of req){body+=chunk;if(body.length>600000){res.statusCode=413;res.end();return;}}
 const request=req as VercelRequest;request.query=Object.fromEntries(url.searchParams);request.body=body?JSON.parse(body):{};request.headers['x-vercel-forwarded-for']='127.0.0.1';
 const response=res as VercelResponse;response.status=(n:number)=>{res.statusCode=n;return response;};response.json=(value:unknown)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return response;};
 await (url.pathname==='/api/agenda'?agenda:booking)(request,response);
 });}}]});await server.listen();
