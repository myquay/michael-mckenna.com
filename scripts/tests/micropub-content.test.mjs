import assert from 'node:assert/strict';
import test from 'node:test';
import { buildUpdate, filterContent, MicropubClient } from '../../blog/themes/win95/assets/js/win95/micropub.mjs';

test('clearing editable properties deletes them but preserves unrelated metadata', () => {
  const payload = buildUpdate('/manage/1', {name:['Title'],summary:['Old'],category:['Old'],photo:['/keep.jpg'],url:['/canonical'],custom:['keep']}, {'post-type':['article'],name:['Title'],content:['Updated']});
  assert.deepEqual(payload.delete, ['category','summary']);
  assert.equal(payload.replace.custom, undefined);
  assert.equal(payload.replace.url, undefined);
});

test('notes preserve hidden titles and summaries on update', () => {
  const payload = buildUpdate('/manage/1', {name:['Existing'],summary:['Existing']}, {'post-type':['note'],content:['Updated']});
  assert.deepEqual(payload.delete, []);
});

test('photo and blogroll fields can be explicitly cleared', () => {
  assert.deepEqual(buildUpdate('/1', {location:['Old'],alt:['Old']}, {'post-type':['photo'],photo:['/new.jpg']}).delete, ['alt','location']);
  assert.deepEqual(buildUpdate('/2', {feed:['https://old.example/feed']}, {'post-type':['blogroll'],url:['https://example.com']}).delete, ['feed']);
});

test('library distinguishes deleted items, published revisions and unpublished edits', () => {
  const items = [
    {postType:'photo',state:'deleted',publishedUrl:'/old',properties:{name:['Old photo']}},
    {postType:'article',state:'published',publishedUrl:'/post',hasUnpublishedChanges:true,properties:{name:['An article'],category:['travel']}},
    {postType:'photo',state:'draft',properties:{name:['Snow']}}
  ];
  assert.equal(filterContent(items,'','published','').length,1);
  assert.equal(filterContent(items,'','draft','').length,2);
  assert.equal(filterContent(items,'photo','','').length,1);
  assert.equal(filterContent(items,'','deleted','old').length,1);
  assert.equal(filterContent(items,'','','travel').length,1);
});

test('unchanged publication dates retain timezone and seconds', () => {
  const input = (value) => ({value});
  const original = '2026-05-22T14:00:42+12:00';
  const date = new Date(original); const offset = date.getTimezoneOffset() * 60000;
  const local = new Date(date.valueOf()-offset).toISOString().slice(0,16);
  const client = {current:{properties:{published:[original]}},form:{elements:{'post-type':input('note'), content:input('Text'), name:input(''), summary:input(''), published:input(local),category:input('')}}};
  assert.equal(MicropubClient.prototype.properties.call(client,'draft').published[0],original);
});
