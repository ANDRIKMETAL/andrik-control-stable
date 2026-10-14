/* ANDRIK R1304 — Boss first, motorcycle escape last.
   Retains the proven R1300 city mechanics and only redirects chapter transitions.
*/
import {CityState as PreviousCityState} from './city-core-r1300.js';
export {CITY_SAVE,CITY_ZONES,roadCenter,RACE_HAZARDS,cityGeometry} from './city-core-r1300.js';
export class CityState extends PreviousCityState {
  constructor(saved){
    super(saved);
    // Old saved race was before the boss. Resume at the boss, never silently grant victory.
    if(saved?.zone===3 && !saved?.race?.postBoss){this.checkpoint=4;this.load(4);}
  }
  interact(){
    if(this.zone===2 && this.exitOpen && this.p.z>this.geo.length-7 && Math.abs(this.p.x)<4){
      this.checkpoint=4;this.load(4);
      this.emit('checkpoint');
      this.emit('notice',{text:'Впереди Ночной надзиратель. Победи его, чтобы добраться до мотоцикла!'});
      return;
    }
    if(this.zone===3 && this.race?.finished && this.p.z>this.geo.length-7 && Math.abs(this.p.x)<4){
      this.finale=.01;this.won=false;this.emit('finale');
      this.emit('notice',{text:'ПОБЕГ УДАЛСЯ! · СТРИТС ПРОЙДЕН'});
      return;
    }
    super.interact();
  }
  hit(e,n,knock){
    const beatBoss=this.zone===4&&e?.kind==='boss'&&e.hp>0&&e.hp<=n;
    super.hit(e,n,knock);
    if(beatBoss&&e.hp<=0){
      // Original State.hit starts the finale immediately. Move it after the chase.
      this.finale=0;this.won=false;this.checkpoint=3;
      this.load(3);this.race.postBoss=true;
      this.emit('checkpoint');
      this.emit('notice',{text:'НАДЗИРАТЕЛЬ ПОБЕЖДЁН! · САДИСЬ НА МОТОЦИКЛ И УХОДИ ОТ ПОГОНИ!'});
    }
  }
  snapshot(){
    const s=super.snapshot();s.cityVersion=2;
    return s;
  }
}
