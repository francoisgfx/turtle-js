function Assembler(canvas,registers_view,jump_table_view,memory_view,test_mode){
   this.test_mode = (test_mode === undefined) ? false : test_mode;
   this.kValue = 0;
   this.kEqual = 1;
   this.kLessThan = 2;
   this.kGreaterThan = 4;
   this.width = 500;
   this.height = 500;
   this.canvas = canvas;
   this.registers_view = registers_view;
   this.jump_table_view = jump_table_view;
   this.memory_view = memory_view;
   this.ctx = this.drawer();
   this.line_no = null;
   
   this.current_line = 0;
   this.code = "";
   this.lines = [];
   
   // ------------------------------------------
   // Jump table
   this.jmp_table = {};
   
   // Memory
   this.mem_size = 256;
   this.memory = new Array(this.mem_size);
   
   // Registers
   this.registers = {
      "rax" : [0],
      "rbx" : [0],
      "rcx" : [0],
      "rdx" : [0],
      "rsi" : [0],
      "rdi" : [0],
      "rsp" : [this.mem_size],
      "rbp" : [0],
      "eflags" : [0],
      //Added registers for tracking the pen position
      "cpx" : [0],
      "cpy" : [0],
      "cpr" : [0],
   };
   
   // implement get method like in python 
   Object.prototype.get = function(name,default_val){
      if(default_val === undefined){ default_val = null; }
      
      if(this.hasOwnProperty(name)){
         return this[name];
      }else{
         return default_val;
      }
   };
   
   // implement startswith method like in python 
   String.prototype.startswith = function(txt){
      if(this[0] === txt){
         return true;
      }else {
         return false;
      }
   };
   
   // implement endswith method like in python 
   String.prototype.endswith = function(txt){
      if(this.slice(-1) === txt){
         return true;
      }else {
         return false;
      }
   };
   
   // for drawing
   this.gLastPos = [this.width/2,this.height/2];
   this.gAngle = 0.0;
   this.gPenDown = false;
   
   return this;
   
}


Assembler.prototype.error = function(msg){
   console.error("ERROR Assembler :",msg);
};


Assembler.prototype.getValue = function(line_no, arg, setting){
   if(setting === undefined){ setting = false}
   var name = null;
   var value = null;
   // Register value
   if(arg.startswith("%")){
      name = arg.slice(1);
      value = this.registers.get(name,null);
      if(value === null){
         this.error(line_no,"Register does not exist");
      }
      return value;
   
   
   // Memory address
   } else if(arg.startswith("%") && arg.endswith(")")){
      name = arg.slice(1,-1);
      var addr = this.registers.get(name,null);
      if(addr === null){
         this.error(line_no, "Accessing invalid memory address", addr);
      }
      value = this.memory[addr];
      return value;
   
   // Constant
   } else if(arg.startswith("$") && setting === false){
      var value_str = arg.slice(1);
      value = null;
      if(!isNaN(value_str)){
         value = parseInt(value_str);
      }else {
         value = this.jmp_table.get(value_str,null);
         if(value === null){
            this.error(line_no, "Given label is not valid");
         }
      }
      return [value];
   
   // Incorrect syntax
   } else {
      this.error(line_no, "The given operand is not accessible");
   }
};


Assembler.prototype.setValue = function(line_no, arg, value){
   var v = this.getValue(line_no,arg,true);
   v[this.kValue] = value;
};


Assembler.prototype.setPosition = function(position){
   if(this.gPenDown){
      this.ctx.lineTo(position[0], position[1]);
      this.ctx.stroke();
   }else{
      this.ctx.moveTo(position[0], position[1]);
   }
   
   this.gLastPos[0] = position[0];
   this.gLastPos[1] = position[1];
   
   this.registers["cpx"][this.kValue] = position[0];
   this.registers["cpy"][this.kValue] = position[1];
   
};


Assembler.prototype.drawer = function(){
   var ctx = this.canvas.getContext('2d');
   this.width = this.canvas.width;
   this.height = this.canvas.height;
   ctx.beginPath();
   return ctx;
};

// INSTRUCTIONS 


Assembler.prototype.fwd = function(line_no,args){
   if(args.length != 1){
      this.error(line_no, "Incorrect number of operands");
   }
   
   var distance = this.getValue(line_no,args[0])[this.kValue];
   distance = parseFloat(distance);
   console.log("angle " + this.gAngle, 'distance ', distance);
   var direction = [
      distance * Math.cos(this.gAngle), 
      distance * Math.sin(this.gAngle)
   ];
   
   console.log('direction ', direction);
   console.log('gLastPos ', this.gLastPos);
   var position = [
      this.gLastPos[0] + direction[0],
      this.gLastPos[1] + direction[1]
   ];
   console.log('position ', position);
   this.setPosition(position);
};


Assembler.prototype.rot = function(line_no, args){
   if(args.length != 1){
      this.error(line_no, "Incorrect number of operands");
   }
   
   var angle = this.getValue(line_no,args[0])[this.kValue];
   
   this.gAngle += ((parseFloat(angle)/180.0) * Math.PI);
   console.log('rot ', this.gAngle);
   this.registers["cpr"][this.kValue] = parseInt((this.gAngle / Math.PI) * 180.0);
};


Assembler.prototype.pen = function(line_no, args){
   if(args.length != 1){
      this.error(line_no, "Incorrect number of operands");
   }
   
   var pen = this.getValue(line_no,args[0])[this.kValue];
   if(pen === 0){
      this.gPenDown = false;
   }else if(pen === 1){
      this.gPenDown = true;
   }else{
      this.error(line_no, "Incorrect value for pen, should be 0 or 1");
   }
};


Assembler.prototype.pos = function(line_no,args){
   if(args.length != 2){
      this.error(line_no, "Incorrect number of operands");
   }
   
   var xArg = args[0];
   var yArg = args[1];
   var x = this.getValue(line_no, xArg)[this.kValue];
   var y = this.getValue(line_no, yArg)[this.kValue];
   
   this.setPosition([x,y]);
};


Assembler.prototype.mov = function(line_no,args){
   if(args.length != 2){
      this.error(line_no, "Incorrect number of operands");
   }
   
   var source = args[0];
   var dest = args[1];
   this.getValue(line_no, dest, true)[this.kValue] = this.getValue(line_no,source)[this.kValue];
};


Assembler.prototype.jmp = function(line_no,args){
   if(args.length != 1){
      this.error(line_no, "Incorrect number of operands");
   }
   
   var label = args[0];
   if(label.startswith("*")){
      line_no[this.kValue] = this.getValue(line_no,label.slice(1))[this.kValue];
   }else{
      var next_line = this.jmp_table.get(label,null);
      if(next_line !== null){
         line_no[this.kValue] = next_line;
      }else{
         this.error(line_no, "Invalid label given");
      }
   }
};


Assembler.prototype.op_cmp = function(line_no,args){
   if(args.length != 2){
      this.error(line_no, "Incorrect number of operands");
   }
   
   var source = args[0];
   var dest = args[1];
   var a = this.getValue(line_no,source)[this.kValue];
   var b = this.getValue(line_no,dest)[this.kValue];
   
   if(a == b){
      this.registers["eflags"][this.kValue] = this.kEqual;
   }else if (b < a){
      this.registers["eflags"][this.kValue] = this.kLessThan;
   }else if (b > a){
      this.registers["eflags"][this.kValue] = this.kGreaterThan;
   }
};


Assembler.prototype.je = function(line_no, args){
   if(args.length != 1){
      this.error(line_no, "Incorrect number of operands");
   }
   
   if(this.registers["eflags"][this.kValue] === this.kEqual){
      var label = args[0];
      var next_line = this.jmp_table.get(label,null);
      if(next_line !== null){
         line_no[this.kValue] = next_line;
      }else{
         this.error(line_no, "Invalid label given");
      }
   }
};


Assembler.prototype.jne = function(line_no,args){
   if(args.length != 1){
      this.error(line_no, "Incorrect number of operands");
   }
   
   if(this.registers["eflags"][this.kValue] === this.kGreaterThan || 
      this.registers["eflags"][this.kValue] === this.kLessThan){
      var label = args[0];
      var next_line = this.jmp_table.get(label,null);
      if(next_line !== null){
         line_no[this.kValue] = next_line;
      }else{
         this.error(line_no, "Invalid label given");
      }
   }
};


Assembler.prototype.ja = function(line_no, args){
   if(args.length != 1){
      this.error(line_no, "Incorrect number of operands");
   }
   
   if(this.registers["eflags"][this.kValue] === this.kGreaterThan){
      var label = args[0];
      var next_line = this.jmp_table.get(label,null);
      if(next_line !== null){
         line_no[this.kValue] = next_line;
      }else{
         this.error(line_no, "Invalid label given");
      }
   }
};


Assembler.prototype.jb = function(line_no, args){
   if(args.length != 1){
      this.error(line_no, "Incorrect number of operands");
   }
   
   if(this.registers["eflags"][this.kValue] === this.kLessThan){
      var label = args[0];
      var next_line = this.jmp_table.get(label,null);
      if(next_line !== null){
         line_no[this.kValue] = next_line;
      }else{
         this.error(line_no, "Invalid label given");
      }
   }
};


Assembler.prototype.sub = function(line_no, args){
   if(args.length != 2){
      this.error(line_no, "Incorrect number of operands");
   }
   
   var a = this.getValue(line_no,args[0]);
   var b = this.getValue(line_no,args[1]);
   b[this.kValue] -= a[this.kValue];
   
};


Assembler.prototype.add = function(line_no, args){
   if(args.length != 2){
      this.error(line_no, "Incorrect number of operands");
   }
   
   var a = this.getValue(line_no,args[0]);
   var b = this.getValue(line_no,args[1]);
   b[this.kValue] += a[this.kValue];
   
};


Assembler.prototype.mul = function(line_no, args){
   if(args.length != 2){
      this.error(line_no, "Incorrect number of operands");
   }
   
   var a = this.getValue(line_no,args[0]);
   var b = this.getValue(line_no,args[1]);
   b[this.kValue] *= a[this.kValue];
   
};


Assembler.prototype.div = function(line_no, args){
   if(args.length != 1){
      this.error(line_no, "Incorrect number of operands");
   }
   
   var a = this.getValue(line_no,args[0]);
   var b = this.registers["rax"];
   // TODO LT: Include rdx in the division
   var result = b[this.kValue] / a[this.kValue];
   var modulo = b[this.kValue] % a[this.kValue];
   b[this.kValue] = result;
   this.registers["rdx"][this.kValue] = modulo;
};


Assembler.prototype.prn = function(line_no, args){
    if(args.length != 1){
      this.error(line_no, "Incorrect number of operands");
   }
   
   console.log(this.getValue(line_no,args[0])[this.kValue]);
};

Assembler.prototype.reset = function() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.restore();
    this.current_line = 0;
    this.gLastPos = [this.width/2,this.height/2];
    this.gAngle = 0.0;
    this.gPenDown = false;
    this.ctx.moveTo(this.gLastPos[0], this.gLastPos[0]);
    
};

Assembler.prototype.setSource = function(src) {
    this.code = src;
    this.lines = this.code.split("\n");
    this.reset();
};

Assembler.prototype.step = function(once) {
    this.current_line++;
    line = this.lines[this.current_line];
    if(line === undefined) {
        return;
    }
    console.log(line);
    
    line = line.replace("\t"," ").replace("\n", "").replace(",", " ");
      
    // strip out comments
    var comment = line.search("#");
    if(comment !== -1){
     line = line.slice(0,comment);
    }

    if(line.endswith(":")){
        var operation = line.replace(" ", "");
        var label = operation.split(":")[0];
        this.jmp_table[label] = this.current_line;
    }
    if(!line.endswith(":") && !line.startswith(".")){
        operation = line.trim().split(" ");
        this.dispatch(this.current_line, operation)
    }
    
    var jump_table_str = '<table id="jump_table"><tr><th><strong>Jump Table</strong></th></tr>\n';
    
    
    for(var key in this.jmp_table)  {
        if (this.jmp_table[key] === this.jmp_table.__proto__[key]) {
            continue;
        }
        jump_table_str += "<tr><td>" + key + "</td><td>" + this.jmp_table[key] + "</td></tr>\n";
    }
    jump_table_str += "</table>"
    
    var registers_str = '<table id="registers_table"><tr><th><strong>Registers</strong></th></tr>\n';
    
    for(var key in this.registers)  {
        if (this.registers[key] === this.registers.__proto__[key]) {
            continue;
        }
        registers_str += "<tr><td>" + key + "</td><td>" + this.registers[key] + "</td></tr>\n";
    }
    
    registers_str += "</table>"
    
    var memory_str = '<table id="memory_table"><th><strong>Memory</strong></th>';
    console.log(this.memory);
    for(var i = 0; i < this.memory.length; i++)  {
        if (this.memory[i] === undefined) {
            continue;
        }
        memory_str += "<tr><td>" + i + "</td><td>" + this.memory[i] + "</td></tr>\n";
    }
    
    memory_str += "</table>"

    
    this.jump_table_view.innerHTML = jump_table_str;//JSON.stringify(this.jmp_table, null, 4);
    this.registers_view.innerHTML = registers_str;//JSON.stringify(this.registers, null, 4);
    this.memory_view.innerHTML = memory_str;//JSON.stringify(this.memory, null, 4);
    
    if(once === undefined) {
        setInterval(this.step.bind(this), 500);
    }
};

Assembler.prototype.run = function() {
    this.step();
};


Assembler.prototype.dispatch = function(line_no, operation){
   var op = operation[0];
   if (op === "") {
       // do nothing
   }
   else if(op === "mov"){
      this.mov(line_no,operation.slice(1));
   }else if(op === "jmp"){
      this.jmp(line_no,operation.slice(1));
   }else if(op === "cmp"){
      this.cmp(line_no,operation.slice(1));
   }else if(op === "je"){
      this.je(line_no,operation.slice(1));
   }else if(op === "jne"){
      this.jne(line_no,operation.slice(1));
   }else if(op === "ja"){
      this.ja(line_no,operation.slice(1));
   }else if(op === "jb"){
      this.jb(line_no,operation.slice(1));
   }else if(op === "add"){
      this.add(line_no,operation.slice(1));
   }else if(op === "sub"){
      this.sub(line_no,operation.slice(1));
   }else if(op === "mul"){
      this.mul(line_no,operation.slice(1));
   }else if(op === "div"){
      this.div(line_no,operation.slice(1));
   }else if(op === "prn"){
      this.prn(line_no,operation.slice(1));
   }else if(op === "pen"){
      this.pen(line_no,operation.slice(1));
   }else if(op === "pos"){
      this.pos(line_no,operation.slice(1));
   }else if(op === "rot"){
      this.rot(line_no,operation.slice(1));
   }else if(op === "fwd"){
      this.fwd(line_no,operation.slice(1));
   }else{
      this.error(line_no, "Incorrect syntax");
   }
};


Assembler.prototype.interpret = function(txt){
   // clear the canvas first
   this.ctx.setTransform(1, 0, 0, 1, 0, 0);
   this.ctx.clearRect(0, 0, this.width, this.height);
   this.ctx.restore();
   
   var code = [];
   var lines = txt.split("\n");
   
   for(var i=0 ; i < lines.length ; i++){
      var line_no = i;
      var line = lines[i];
      line = line.replace("\t"," ").replace("\n", "").replace(",", " ");
      
      // strip out comments
      var comment = line.search("#");
      if(comment !== -1){
         line = line.slice(0,comment);
      }
      
      if(line.endswith(":")){
         var operation = line.replace(" ", "");
         var label = operation.split(":")[0];
         this.jmp_table[label] = line_no;
      }
      code.push(line);
   }
   var rip = 0;
   this.line_no = [];
   while(rip < code.length){
      this.line_no = [rip];
      line = code[rip];
      if(!line.endswith(":") && !line.startswith(".")){
         operation = line.trim().split(" ");
         if(operation[0] !== ""){ // split always return an empty element 
            this.dispatch(this.line_no,operation);
         }
      }
      rip = this.line_no[this.kValue] + 1;
   }
};
