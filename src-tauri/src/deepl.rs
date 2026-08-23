use reqwest::{
    Client,
    StatusCode,
};

use serde::{
    Deserialize,
    Serialize,
};

const DEEPL_FREE_URL: &str =
    "https://api-free.deepl.com/v2/translate";

const DEEPL_PRO_URL: &str =
    "https://api.deepl.com/v2/translate";


/* =========================================================
 * Command types
 * ======================================================= */

#[derive(
    Debug,
    Deserialize,
)]
#[serde(rename_all = "camelCase")]
pub struct DeepLTranslateCommandRequest {
    pub api_key:
        String,

    pub text:
        String,

    pub source_language:
        Option<String>,

    pub target_language:
        String,
}

#[derive(
    Debug,
    Serialize,
)]
#[serde(rename_all = "camelCase")]
pub struct DeepLTranslateCommandResponse {
    pub translated_text:
        String,

    pub detected_source_language:
        Option<String>,
}


/* =========================================================
 * DeepL API types
 * ======================================================= */

#[derive(Serialize)]
struct DeepLApiRequest {
    text:
        Vec<String>,

    target_lang:
        String,

    #[serde(
        skip_serializing_if = "Option::is_none"
    )]
    source_lang:
        Option<String>,

    preserve_formatting:
        bool,
}

#[derive(
    Debug,
    Deserialize,
)]
struct DeepLApiResponse {
    translations:
        Vec<DeepLTranslation>,
}

#[derive(
    Debug,
    Deserialize,
)]
struct DeepLTranslation {
    text:
        String,

    detected_source_language:
        Option<String>,
}


/* =========================================================
 * Language normalization
 * ======================================================= */

fn normalize_source_language(
    language: &str,
) -> Option<String> {
    let trimmed =
        language.trim();

    if trimmed.is_empty()
        || trimmed.eq_ignore_ascii_case(
            "auto",
        )
    {
        return None;
    }

    let normalized =
        trimmed
            .replace(
                '_',
                "-",
            )
            .to_lowercase();

    let code =
        match normalized.as_str() {
            /*
             * DeepL accepts generic source
             * codes for these languages.
             */
            "en-us"
            | "en-gb" => {
                "EN".to_string()
            }

            "pt-br"
            | "pt-pt" => {
                "PT".to_string()
            }

            "zh-cn"
            | "zh-tw"
            | "zh-hans"
            | "zh-hant" => {
                "ZH".to_string()
            }

            /*
             * LocalizationHub currently uses
             * "no" for Norwegian while DeepL
             * uses NB.
             */
            "no"
            | "nb" => {
                "NB".to_string()
            }

            _ => {
                normalized
                    .split('-')
                    .next()
                    .unwrap_or(
                        &normalized,
                    )
                    .to_uppercase()
            }
        };

    if code.is_empty() {
        None
    } else {
        Some(
            code,
        )
    }
}

fn normalize_target_language(
    language: &str,
) -> Option<String> {
    let trimmed =
        language.trim();

    if trimmed.is_empty()
        || trimmed.eq_ignore_ascii_case(
            "auto",
        )
    {
        return None;
    }

    let normalized =
        trimmed
            .replace(
                '_',
                "-",
            )
            .to_lowercase();

    let code =
        match normalized.as_str() {
            /*
             * DeepL target English requires
             * a regional variant.
             *
             * LocalizationHub's generic "en"
             * defaults to US English.
             */
            "en" => {
                "EN-US".to_string()
            }

            "en-us" => {
                "EN-US".to_string()
            }

            "en-gb" => {
                "EN-GB".to_string()
            }

            /*
             * Generic Portuguese defaults
             * to European Portuguese.
             */
            "pt" => {
                "PT-PT".to_string()
            }

            "pt-br" => {
                "PT-BR".to_string()
            }

            "pt-pt" => {
                "PT-PT".to_string()
            }

            /*
             * Match our current Chinese
             * language options with DeepL's
             * script-specific target codes.
             */
            "zh-cn"
            | "zh-hans" => {
                "ZH-HANS".to_string()
            }

            "zh-tw"
            | "zh-hant" => {
                "ZH-HANT".to_string()
            }

            "zh" => {
                "ZH".to_string()
            }

            "no"
            | "nb" => {
                "NB".to_string()
            }

            _ => {
                normalized
                    .split('-')
                    .next()
                    .unwrap_or(
                        &normalized,
                    )
                    .to_uppercase()
            }
        };

    if code.is_empty() {
        None
    } else {
        Some(
            code,
        )
    }
}


/* =========================================================
 * Endpoint + errors
 * ======================================================= */

fn deepl_endpoint(
    api_key: &str,
) -> &'static str {
    /*
     * DeepL API Free keys normally end
     * in ":fx".
     */
    if api_key.ends_with(
        ":fx",
    ) {
        DEEPL_FREE_URL
    } else {
        DEEPL_PRO_URL
    }
}

fn deepl_error_message(
    status:
        StatusCode,
) -> String {
    match status.as_u16() {
        400 => {
            "DeepL rejected the request. Check the selected languages and text.".to_string()
        }

        401
        | 403 => {
            "DeepL rejected the API key. Check that the key is valid and belongs to a DeepL API account.".to_string()
        }

        413 => {
            "The text is too large for a single DeepL request.".to_string()
        }

        429 => {
            "DeepL rate limit was reached. Try again shortly.".to_string()
        }

        /*
         * DeepL uses HTTP 456 when the
         * account's translation quota
         * has been exhausted.
         */
        456 => {
            "DeepL translation quota has been reached.".to_string()
        }

        code
            if code >= 500 =>
        {
            "DeepL is temporarily unavailable. Try again later.".to_string()
        }

        code => {
            format!(
                "DeepL request failed with status {}.",
                code,
            )
        }
    }
}


/* =========================================================
 * Translate command
 * ======================================================= */

#[tauri::command]
pub async fn translate_with_deepl(
    request:
        DeepLTranslateCommandRequest,
) -> Result<
    DeepLTranslateCommandResponse,
    String,
> {
    /*
     * SECURITY:
     *
     * Never log this request.
     *
     * It contains the user's DeepL
     * authentication key.
     *
     * LocalizationHub does not persist
     * this key anywhere.
     */

    let api_key =
        request.api_key.trim();

    if api_key.is_empty() {
        return Err(
            "Enter a DeepL API key.".to_string(),
        );
    }

    let text =
        request.text.trim();

    if text.is_empty() {
        return Err(
            "Paste some text to translate.".to_string(),
        );
    }

    let target_language =
        normalize_target_language(
            &request.target_language,
        )
        .ok_or_else(
            || {
                "Choose a valid target language.".to_string()
            },
        )?;

    let source_language =
        request
            .source_language
            .as_deref()
            .and_then(
                normalize_source_language,
            );

    let api_request =
        DeepLApiRequest {
            text:
                vec![
                    text.to_string(),
                ],

            target_lang:
                target_language,

            source_lang:
                source_language,

            preserve_formatting:
                true,
        };

    let endpoint =
        deepl_endpoint(
            api_key,
        );

    let authorization =
        format!(
            "DeepL-Auth-Key {}",
            api_key,
        );

    let client =
        Client::new();

    let response =
        client
            .post(
                endpoint,
            )
            .header(
                "Authorization",
                authorization,
            )
            .json(
                &api_request,
            )
            .send()
            .await
            .map_err(
                |_| {
                    "Could not connect to DeepL.".to_string()
                },
            )?;

    let status =
        response.status();

    if !status.is_success() {
        /*
         * Do not expose DeepL's raw
         * response body.
         *
         * Keep provider errors sanitized.
         */
        return Err(
            deepl_error_message(
                status,
            ),
        );
    }

    let api_response =
        response
            .json::<
                DeepLApiResponse,
            >()
            .await
            .map_err(
                |_| {
                    "DeepL returned an invalid response.".to_string()
                },
            )?;

    let translation =
        api_response
            .translations
            .into_iter()
            .next()
            .ok_or_else(
                || {
                    "DeepL returned no translation.".to_string()
                },
            )?;

    Ok(
        DeepLTranslateCommandResponse {
            translated_text:
                translation.text,

            detected_source_language:
                translation
                    .detected_source_language,
        },
    )
}