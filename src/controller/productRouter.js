let express=require('express')
let productRouter=express.Router()

function router(){
    productRouter.route('/')
  .get((req,res)=>{res.send('this is product route')})

productRouter.route('/details')
  .get((req,res)=>{res.send('this is product details')})

  return productRouter


}
module.exports=router



