const NEXT={queued:['accepted','blocked','failed'],accepted:['running','blocked','failed'],running:['done','blocked','failed'],blocked:[],done:[],failed:[]};
export class TaskState {
  constructor(taskId){this.taskId=taskId;this.status='queued';this.events=[{status:'queued'}];}
  transition(status,detail=null){if(!(NEXT[this.status]||[]).includes(status))throw new Error('INVALID_STATE_TRANSITION');this.status=status;this.events.push({status,detail});return this;}
}
