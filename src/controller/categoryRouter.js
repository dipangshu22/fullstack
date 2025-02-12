let express=require('express')
let categoryRouter=express.Router()

function router(){
    categoryRouter.route('/')
  .get((req,res)=>{res.send('this is category route')})

categoryRouter.route('/details')
  .get((req,res)=>{res.send('this is category details')})
  return categoryRouter


}
module.exports=router


