import express from 'express';
const app = express();
app.use(express.static('public'));
app.get('/health', (_req,res)=>res.json({ok:true}));
app.listen(process.env.PORT||3000, ()=> console.log('OK'));
