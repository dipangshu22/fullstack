let express=require('express')
let app=express()
let port=8810

let categoryRouter=require('./src/controller/categoryRouter')()
let productRouter=require('./src/controller/productRouter')()
//static file path 
app.use(express.static(__dirname+'/public'))
//ejs file path
app.set('views','./src/views')
//view engine
app.use('view engine','ejs')
app.use('/category',categoryRouter)
app.use('/product',productRouter)

app.listen(port,(err)=>{
    if(err) throw err
    console.log("server is running on port"+port)
})
