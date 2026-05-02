---
name: harness-api-standards
description: OpenAPI-based API design standards with utoipa, axum, validator, serde, sqlx, and Rust idioms.
---

## Technology Stack

| Item | Library |
|------|---------|
| HTTP framework | axum (tokio runtime) |
| Schema definition + Validation | validator + serde |
| OpenAPI generation | utoipa + utoipa-axum |
| Documentation UI | utoipa-swagger-ui or utoipa-redoc |
| Client generation | openapi-typescript (TS frontend が utoipa 出力 openapi.json を consume) |
| DB query | sqlx (compile-time SQL 検証) |
| DB migration | refinery + .rs migrations |

## Directory Structure

```
src/backend/crates/presentation/
├── Cargo.toml              # [dependencies] axum + utoipa + tokio + application + domain
├── src/
│   ├── lib.rs              # router 公開 export
│   ├── main.rs             # tokio runtime + axum::serve
│   ├── routes/
│   │   └── {feature}/
│   │       ├── mod.rs       # route handler 関数 + #[utoipa::path] derive
│   │       └── schemas.rs   # request/response struct + ToSchema/Validate derive
│   ├── middleware/          # axum::middleware::from_fn 系
│   └── openapi.rs           # OpenApi struct を utoipa::OpenApi derive で組立
└── tests/                  # integration tests (axum::Router を直接呼ぶ)
```

## Implementation Patterns

### Schema definition (validator + serde + utoipa)

```rust
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::Validate;

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema, Validate)]
pub struct CreateUserRequest {
    #[validate(length(min = 1, max = 100))]
    #[schema(example = "山田太郎")]
    pub name: String,

    #[validate(email)]
    #[schema(example = "user@example.com")]
    pub email: String,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct UserResponse {
    #[schema(example = 1)]
    pub id: i64,
    pub name: String,
    pub email: String,
}
```

### Route definition (axum + utoipa derive)

```rust
use axum::{Json, extract::State};
use utoipa::OpenApi;

#[utoipa::path(
    post,
    path = "/users",
    request_body = CreateUserRequest,
    responses(
        (status = 201, description = "User created", body = UserResponse),
        (status = 400, description = "Validation error"),
    ),
    tag = "users"
)]
pub async fn create_user(
    State(state): State<AppState>,
    Json(req): Json<CreateUserRequest>,
) -> Result<Json<UserResponse>, ApiError> {
    req.validate().map_err(ApiError::from)?;
    let user = state.user_use_case.create(req.into()).await?;
    Ok(Json(user.into()))
}

pub fn router() -> axum::Router<AppState> {
    axum::Router::new().route("/users", axum::routing::post(create_user))
}
```

### OpenAPI assembly (utoipa::OpenApi derive)

```rust
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    paths(routes::users::create_user, routes::users::get_user),
    components(schemas(CreateUserRequest, UserResponse, ApiError)),
    tags((name = "users", description = "User management"))
)]
pub struct ApiDoc;
```

`ApiDoc::openapi().to_pretty_json()?` で `openapi.json` を出力 → TS frontend の `openapi-typescript` で client 自動生成。

### Error handling (thiserror + axum::IntoResponse)

```rust
use axum::{http::StatusCode, response::IntoResponse, Json};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ApiError {
    #[error("validation failed: {0}")]
    Validation(#[from] validator::ValidationErrors),
    #[error("not found")]
    NotFound,
    #[error(transparent)]
    Internal(#[from] anyhow::Error),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        let (status, msg) = match &self {
            ApiError::Validation(_) => (StatusCode::BAD_REQUEST, self.to_string()),
            ApiError::NotFound => (StatusCode::NOT_FOUND, "not found".into()),
            ApiError::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, "internal".into()),
        };
        (status, Json(serde_json::json!({"error": msg}))).into_response()
    }
}
```

### DB query (sqlx, compile-time 検証)

```rust
let user = sqlx::query_as!(
    User,
    "SELECT id, name, email FROM users WHERE id = $1",
    user_id
)
.fetch_one(&pool)
.await?;
```

### DB migration (refinery + .rs migrations)

`crates/infrastructure/migrations/V001__init.rs`:

```rust
use barrel::{types, Migration};
use refinery::Migration as RefineryMigration;

pub fn migration() -> String {
    let mut m = Migration::new();
    m.create_table("users", |t| {
        t.add_column("id", types::primary());
        t.add_column("name", types::varchar(100));
        t.add_column("email", types::varchar(255).unique(true));
    });
    m.make::<barrel::backend::Pg>()
}
```

`crates/infrastructure/src/lib.rs` で `refinery::embed_migrations!("migrations")` で取り込み、起動時に `runner().run(&mut conn)` で実行。

## Versioning

URL path versioning(`/v1/users`、`/v2/users`)を default。axum `Router::nest("/v1", v1_router())` で実装。

## Response format

成功: `200 OK` + JSON body
エラー: `4xx/5xx` + `{"error": "<message>"}` JSON body(ApiError::IntoResponse)
