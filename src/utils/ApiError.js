class ApiError extends Error{
   constructor(
      statusCode,
      message = "Something went wrong",
      errors = [],
      statck = ""
   ){
      super(message);
      this.statusCode = statusCode;
      this.data = null;
      this.message = message;
      this.errors = errors;
      
      if(statck){
         this.statck = statck;
      }
      else{
         Error.captureStackTarce(this, this.constructor);
      }
   }
}