import {CookieConstructorInterface, CookieInterface} from "./cookie";

type AxiosRequestConfig = import("axios").AxiosRequestConfig;
type AxiosResponse = import("axios").AxiosResponse;

export interface SessionInterface {
	/**
	 * このセッションを用いてGETリクエストを発行する。
	 * @param url リクエスト先のURL
	 * @param options 
	 */
	get(url: string, options?: AxiosRequestConfig): Promise<SessionResponseInterface>;
	/**
	 * このセッションを用いてPOSTリクエストを発行する。
	 * @param url リクエスト先のURL
	 * @param data リクエストボディに含めるデータ。 
	 * @param options 
	 */
	post(url: string, data?: any, options?: AxiosRequestConfig): Promise<SessionResponseInterface>;
	/**
	 * 現在のセッション情報を破棄します
	 */
	removeSession(): Promise<void>;
}

export interface SessionResponseInterface {
	/**
	 * レスポンスのHTTPステータスコード。
	 */
	 status: number;
	 /**
	  * レスポンス本文。
	  */
	 data: string;
	/**
	 * HTTPヘッダー
	 */
	 headers: {
		location?: string
	 }
	 /**
	  * このレスポンスの情報を用いてセッションを保存
	  */
	 saveSession(): Promise<void>
}

/**
 * セッション管理用クラス
 * こいつでcookieを使いまわしてログイン認証した状態でデータをとってくる
 */
export class Session implements SessionInterface {
	private static _axios: import("axios").AxiosInstance | null = null;
	private CookieConstructor: CookieConstructorInterface
	private _cookies: CookieInterface | null;

	constructor(CookieConstructor: CookieConstructorInterface) {
		this.CookieConstructor = CookieConstructor
		this._cookies = null;
	}

	// 必要になった瞬間にaxiosをimportする
	static async importAxios(): Promise<import("axios").AxiosInstance> {
		if (Session._axios === null) {
			const _axios = (await import("axios")).default;
			// 常にtext/htmlをAcceptヘッダーに加えて通信する
			return Session._axios = _axios.create({headers: {Accept: "text/html"}});
		}
		return Session._axios;
	}

	async getCookies(): Promise<CookieInterface> {
		if (this._cookies === null) {
			return this._cookies = await this.CookieConstructor.createLoadedInstance();
		}
		return this._cookies;
	}

	async get(url: string, options: AxiosRequestConfig = {}): Promise<SessionResponseInterface> {
		return this.makeSessionResponse(await (await Session.importAxios())(url, {
			headers: {
				Cookie: (await this.getCookies()).get().join("; ")
			},
			...options
		}))
	}

	async post(url: string, data?: any, options: AxiosRequestConfig = {}): Promise<SessionResponseInterface> {
		return this.makeSessionResponse(await (await Session.importAxios()).post(url, data, {
			headers: {
				Cookie: (await this.getCookies()).get().join("; ")
			},
			...options
		}))
	}

	private makeSessionResponse({status, data, headers}: AxiosResponse): SessionResponseInterface {
		const saveSession = async ()=>{
			const new_cookies = this.CookieConstructor.convertSetCookies2CookieArray(headers["set-cookie"]);
			await this.saveSessionFromCookies(new_cookies);
		}
		return {
			status,
			data,
			headers,
			saveSession
		}
	}

	private async saveSessionFromCookies(cookies: Array<string>): Promise<void> {
		const session_cookies = await this.getCookies();
		session_cookies.set(cookies);
		await session_cookies.saveConfigFile();
	}

	async removeSession(): Promise<void> {
		const session_cooies = (await this.getCookies());
		session_cooies.empty();
		// 空のcookieで設定ファイルを上書きする
		await session_cooies.saveConfigFile();
	}
}
