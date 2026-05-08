import {lib, game, ui, get, ai, _status} from '../../../noname.js';
import update from '../function/update.js';
export let config = {
    // 小提示
    ql_tips: { 
        name: `<span color="blue">小提示</span><font size="2px" class="sw_control"> ==>点击展开</font></span>`, 
        intro: "五花米线",
        init: true,
        clear: true,
        onclick: function () {
            if (this.help === undefined) {
                var log = [
                    `本扩展武将均由作者与作者的发小设计，无搬运抄袭`,
                    `本扩展可以在游玩过程中提供辅助但是作用有限`,
                    `若有报错或疑问，请联系作者：`,
                    `&nbsp;&nbsp;&nbsp;&nbsp;Q：3020421870`,
                    `&nbsp;&nbsp;&nbsp;&nbsp;Q裙：884054958`,
                ];

                var more = ui.create.div('.help', '<div style="border:2px solid gray"><P align=left>' + log.join('<br>') + '</P>');
                this.parentNode.insertBefore(more, this.nextSibling);
                this.help = more;
                this.innerHTML = `<span color="blue">小提示</span><font size="2px" class="sw_control"> ↓↓↓↓↓↓</font></span>`;
            } else {
                this.parentNode.removeChild(this.help);
                delete this.help;
                this.innerHTML = `<span color="blue">小提示</span><font size="2px" class="sw_control"> ==>点击展开</font></span>`;
            };
        },
    },
    'openWinDialog':{
        name:`<span style='text-decoration:underline;'>打开战绩页面(感谢点绛唇)</span>`,
    	clear:true,
    	onclick:function(){
    		game.openWinDialog();
    	}
    },
    //联机自由点将
    ql_connect:{
        name: "<font color = '#28e5dd'>联机自由点将</font>",
        init: true,
        intro: "启用后，玩家可在联机进行自由点将",
    },
    
    // 守卫
    ql_guard: {
        name: "开启<font color = '#ff00ff'>守卫</font>机制",
        init: true,
        intro: "启用后，角色不会失去技能和换武将牌",
    },
    
    // 致知
    ql_zhizhi: {
        name: "开启<font color = '#e4e414'>致知</font>机制",
        init: true,
        intro: "启用后，拥有致知效果的技能得到增强",
    },
    
    // 焕彰
    ql_huanzhang: {
        name: "开启<font color = '#e45914'>焕彰</font>机制",
        init: false,
        intro: "启用后，拥有焕彰效果的技能得到增强",
    },
    
    // 月相
    ql_moonPhase: {
        name: `<font color="#fdfdd6">开启月相`,
        init: false,
        intro: "是否开启月相？（每轮开始时，随机抽取一个本轮月相，每个月相有不同的效果。关闭后不影响相关机制角色）<br>下局游戏生效",
    },
    auto_update: {
          name: `<font color="#ff9800">自动检测更新`,
          init: true,
          intro: "启动游戏时自动检查更新",
    },
    check_update: {
          name: `<span style="color:#4caf50;text-decoration: underline">检查更新`,
          clear: true,
          onclick: async function () {
             this.innerHTML = `<span style="color:#f61515ff;text-decoration: underline">正在检测更新...`;
              try {
                 await update(true);
                 this.innerHTML = `<span style="color:#4caf50;text-decoration: underline">更新完成`;
              } catch {
                 this.innerHTML = `<span style="color:#f44336;text-decoration: underline">更新失败`;
              }
              setTimeout(() => {
                  this.innerHTML = `<span style="color:#4caf50;text-decoration: underline">检查更新`;
              }, 2000);
          }
    }
}