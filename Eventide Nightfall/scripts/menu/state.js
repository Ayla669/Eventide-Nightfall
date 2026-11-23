const state = {
    background: null,
    active: false,
    callbacks: [],

    whenIntroDone: function(cb){
        if(!state.active){
            cb();
        }else{
            state.callbacks.push(cb);
        }
    },

    finish: function(){
        state.active = false;
        const list = state.callbacks;
        state.callbacks = [];
        for(let i = 0; i < list.length; i++){
            try{
                list[i]();
            }catch(e){
                print("Eventide: erro apos a intro: " + e);
            }
        }
    }
};

try{
    state.active = !Vars.headless && Core.settings.getBool("eventide-intro", true);
}catch(e){
    state.active = false;
}

module.exports = state;
