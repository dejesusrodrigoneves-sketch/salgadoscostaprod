-- CreateTable
CREATE TABLE "login_logs" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "logado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_logs_pkey" PRIMARY KEY ("id")
);
