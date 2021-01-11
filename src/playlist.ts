import { Playable } from './base/playable';

export class Playlist extends Playable {
  static TAG = 'Playlist';
  TYPE = 'playlist';

  protected _loadData(data: any) {
    // console.log(JSON.stringify(data));
    // TODO
  }

  protected _loadFullData(data: any) {
    this._loadData(data);
  }
}
