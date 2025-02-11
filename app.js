let express=require('express')
let app=express()
let port=8810

let categoryRouter=express.Router()
let productRouter=express.Router()

categoryRouter.route('/')
  .get((req,res)=>{res.send('this is category route')})

categoryRouter.route('/details')
  .get((req,res)=>{res.send('this is category details')})

productRouter.route('/')
  .get((req,res)=>{res.send('this is product route')})

productRouter.route('/details')
  .get((req,res)=>{res.send('this is product details')})



app.use('/category',categoryRouter)
app.use('/product',productRouter)

app.listen(port,(err)=>{
    if(err) throw err
    console.log("server is running on port"+port)
})
