# Requirements Document

## Introduction
Serverless 構成でもファシリテーターが自律的に新規セッションを作成し、参加者へ joinToken を配布して Notion バックログとのリンクを確立できる状態を目指す。ここではサーバーレス WebSocket バックエンドと CSR UI の双方に求められる振る舞いを要求として定義する。

## Requirements

### Requirement 1: セッション作成ワークフロー
**Objective:** ファシリテーターとして、serverless の UI/API からセッションを登録したい。そうすればチームが計画ミーティングを開始できる。

#### Acceptance Criteria
1. When ファシリテーターがセッション名・バックログソース・見積もりモードを入力した作成フォームを送信するとき, the Serverless Session Service shall その内容を含むセッションレコードを永続化する。
2. If 必須の入力が欠落または不正であるとき, the Serverless Session Service shall 問題のある項目を示すバリデーションエラーで応答する。
3. While セッション作成が成功している間, the Serverless Session Service shall グローバル一意な sessionId と作成タイムスタンプをレコードへ付与する。
4. Where バックログフィルターが指定されている場合, the Serverless Session Service shall フィルター定義をセッションメタデータとともに保存する。

### Requirement 2: JoinToken 発行と配布
**Objective:** ファシリテーターとして、安全な joinToken を受け取りたい。そうすれば参加者が安全に接続できる。

#### Acceptance Criteria
1. When セッションが作成されたとき, the Serverless Session Service shall 16 文字以上のランダム文字列を含む joinToken を1つ以上生成する。
2. The Serverless Session Service shall SessionAccess ストアへ保存する前にすべての joinToken をハッシュ化する。
3. If ファシリテーターが新しい joinToken を要求するとき, the Serverless Session Service shall 置き換え用のトークンを発行し、既存トークンを無効化する。
4. When サービスが作成レスポンスを返すとき, the Session Creation UI shall joinToken の平文を1度だけ表示し、コピーできるようにする。
5. If joinToken の生成に失敗したとき, the Serverless Session Service shall 失敗をログに記録し、再試行やサポート連絡を案内する。

### Requirement 3: アクセス制御とセッション属性
**Objective:** プラットフォーム管理者として、作成時にアクセス制御情報を登録したい。そうすれば WebSocket バリデータが最新状態で判断できる。

#### Acceptance Criteria
1. When セッションが作成されたとき, the Serverless Session Service shall 入力値または既定値の接続上限を記録する。
2. While セッションが有効な間, the Serverless Session Service shall 各 joinToken に有効期限タイムスタンプを保持する。
3. If ファシリテーターが現在時刻より過去の有効期限を指定するとき, the Serverless Session Service shall 無効なタイムスタンプを示すエラーでリクエストを拒否する。
4. Where ファシリテーターが公開閲覧を有効化した場合, the Serverless Session Service shall 非認証参加者向けに読み取り専用フラグを立てる。
5. The Serverless Session Service shall sessionId・オーナー識別子・接続上限を含む構造化ログをセッション作成ごとに出力する。

### Requirement 4: セッション作成 UI とフィードバック
**Objective:** ファシリテーターとして、ガイダンス付き UI で作成したい。そうすれば入力ミスなくセッションを立ち上げられる。

#### Acceptance Criteria
1. When ファシリテーターがセッション作成画面を開くとき, the Session Creation UI shall セッション名・バックログソース・任意フィルター・接続上限・公開設定の項目を表示する。
2. While 作成リクエストを処理中の間, the Session Creation UI shall 送信アクションを無効化し、進行状況を表示する。
3. When 作成に成功したとき, the Session Creation UI shall sessionId と joinToken を含む確認メッセージを提示し、コピーや共有ができる状態にする。
4. If 作成が失敗したとき, the Session Creation UI shall Serverless Session Service が返した理由を示すエラーバナーを表示する。
5. Where ファシリテーターが前回設定の再利用を選択した場合, the Session Creation UI shall 直近の保存値でフォームを自動入力する。
