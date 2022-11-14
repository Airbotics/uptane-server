import express, { Request, Response, NextFunction } from 'express';


const app = express();

app.use(express.json());


app.use((req, res, next) => {
    console.log(`${req.method} - ${req.originalUrl}`);
    next();
})

// health check
app.get('/', (req, res) => {
    return res.status(200).end();
})


// handle 404
app.use((req: Request, res: Response, next: NextFunction) => {
    console.log('404');
    return res.status(404).end();
})


// handle 500
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err);
    return res.status(500).end();
})


export default app;