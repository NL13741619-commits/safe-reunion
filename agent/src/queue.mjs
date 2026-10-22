export class InMemoryDryRunQueue {
  constructor(){this.items=[];}
  enqueue(task){this.items.push(structuredClone(task));return{queued:true,depth:this.items.length};}
  dequeue(){return this.items.shift()??null;}
  get durable(){return false;}
}
