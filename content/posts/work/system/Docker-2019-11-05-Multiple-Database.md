---
title: "Docker MySQL, Postgresql Multiple Databases"
date: "2019-11-05"
template: "post"
draft: false
slug: "/posts/system/docker-multiple-databases"
category: "System"
tags:
  - "Docker"
  - "Docker Compose"
  - "Docker Container"
  - "MySQL"
  - "Postgres"
  - "Multiple Databases"
description: "Docker MySQL, Postgresql에서 Multiple Database 사용하기"
---


## Introduction

서비스 개발 환경, 운영환경을 구성하는 중, 다수의 DB를 사용해야 하는 경우가 발생한다. 

하나의 서비스 개발 환경에 다수의 Application이 존재하고, 각 Application 별로 독립된 Database를 사용하길 원하는 경우,

Service Deploy 시에 하나의 Database 서버 (AWS를 사용하는 경우 하나의 RDS) 내에 다수의 Database를 생성하여 사용할 수 있다.

이러한 환경을 Docker를 사용하는 개발환경에도 동일하게 적용하기 위해 하나의 Database Container 내에 여러개의 Database를 생성하는 것이 필요한 경우가 있다.

## MySQL 

Docker MySQL 공식 이미지(<https://hub.docker.com/_/mysql>)에는 아래와 같은 환경 변수를 활용하여, 최초 Container 생성시에 사용할 Database를 정의한다. 

- MYSQL_ROOT_PASSWORD : Database의 Root 계정 비밀번호
- MYSQL_DATABASE : Database 명
- MYSQL_USER : User 명, 해당 User는 MYSQL_DATABASE에 정의된 DB에 superuser 권한을 가진다. 
- MYSQL_PASSWORD : User의 패스워드

그리고, **Initializing a fresh instance** 섹션의 내용을 보면, Container 가 최초로 실행될 때  /docker-entrypoint-initdb.d 내의 .sh, .sql and .sql.gz 의 확장자를 가지는 파일들이 알파벳 순서에 따라 실행된다고 명시되어 있다. 

이를 활용하여, Docker Container 실행 시에 아래와 같은 스크립트를 /docker-entrypoint-initdb.d 내에 마운트 시키고, Multiple Database를 생성하도록 만들 수 있다. 

```bash 
# initialize_mysql_multiple_databases.sh

if [ -n "$MYSQL_MULTIPLE_DATABASES" ]; then

  for dbname in $(echo $MYSQL_MULTIPLE_DATABASES | tr ',' ' '); do
	  mysql -u root -p$MYSQL_ROOT_PASSWORD <<-EOSQL
	    CREATE DATABASE $dbname;
      GRANT ALL PRIVILEGES ON $dbname.* TO '$MYSQL_USER'@'%';
EOSQL
  done
fi
```

그리고 아래와 같은 Command를 통해 MySQL Container를 실행한다. MySQL 컨테이너를 실행할 때 MYSQL_MULTIPLE_DATABASES 환경 변수를 함께 전달한다. 

```bash 
$ docker run -e MYSQL_ROOT_PASSWORD=test -e MYSQL_MULTIPLE_DATABASES=test_db1,test_db2 -e MYSQL_USER=test -e MYSQL_PASSWORD=test -v $PWD/initialize_mysql_multiple_databases.sh:/docker-entrypoint-initdb.d/initialize_mysql_multiple_databases.sh -p 3306:3306 mysql:5.7
```

아래와 같이 Database의 정상 생성 여부를 확인해본다. 

```bash
$ docker exec -it 74cbb371a00e mysql -u test -p 
mysql> show databases;
+--------------------+
| Database           |
+--------------------+
| information_schema |
| test_db1           |
| test_db2           |
+--------------------+
3 rows in set (0.00 sec)
```

test_db1, test_db2가 정상적으로 생성되었음을 확인할 수 있다.


## Postgresql

Postgresql도 MySQL과 비슷한 방식으로 Multiple Databases를 생성할 수 있다.
Postgresql의 Docker 공식 이미지(<https://hub.docker.com/_/postgres>)는 아래와 같은 환경변수를 사용한다. 

- POSTGRES_DB : 생성할 데이터베이스 이름
- POSTGRES_USER : 생성할 User
- POSTGRES_PASSWORD : 생성할 User의 Password

또한 **Initialization scripts** 섹션을 보면, MySQL과 유사하게 *.sql, *.sql.gz, *.sh 등의 확장자를 가지는 파일이 /docker-entrypoint-initdb.d 에 존재하는 경우, 해당 스크립트를 최초 컨테이너 생성 시 실행한다. 

이를 이용하여, Multiple Database를 생성하기 위해, 아래와 같은 스크립트를 작성한다.

```bash
# initialize_postgresql_multiple_databases.sh

if [ -n "$POSTGRES_MULTIPLE_DB" ]; then
	for dbname in $(echo $POSTGRES_MULTIPLE_DB | tr ',' ' '); do
	psql --username "$POSTGRES_USER" <<-EOSQL
	    CREATE DATABASE $dbname;
	    GRANT ALL PRIVILEGES ON DATABASE $dbname TO $POSTGRES_USER;
EOSQL
	done
fi
```

마찬가지로 docker run을 통해 postgresql 데이터베이스 컨테이너를 실행한다.

```bash
docker run -e POSTGRES_MULTIPLE_DB=test_db1,test_db2 -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -v $PWD/initialize_postgresql_multiple_databases.sh:/docker-entrypoint-initdb.d/initialize_postgresql_multiple_databases.sh postgres
```

아래와 같은 명령어를 통해 database 가 정상적으로 생성되었음을 확인할 수 있다. (postgres의 database list 출력 명령어는 \l 이다)

```bash
$ docker exec -it bc34bdd92dcc psql --username test --password
Password:
psql (12.0 (Debian 12.0-2.pgdg100+1))
Type "help" for help.

test=# \l
                             List of databases
   Name    | Owner | Encoding |  Collate   |   Ctype    | Access privileges
-----------+-------+----------+------------+------------+-------------------
 postgres  | test  | UTF8     | en_US.utf8 | en_US.utf8 |
 template0 | test  | UTF8     | en_US.utf8 | en_US.utf8 | =c/test          +
           |       |          |            |            | test=CTc/test
 template1 | test  | UTF8     | en_US.utf8 | en_US.utf8 | =c/test          +
           |       |          |            |            | test=CTc/test
 test      | test  | UTF8     | en_US.utf8 | en_US.utf8 |
 test_db1  | test  | UTF8     | en_US.utf8 | en_US.utf8 | =Tc/test         +
           |       |          |            |            | test=CTc/test
 test_db2  | test  | UTF8     | en_US.utf8 | en_US.utf8 | =Tc/test         +
           |       |          |            |            | test=CTc/test
(6 rows)
```

## Docker Compose 사용하기

위의 내용을 Docker Compose를 사용하여 동일하게 적용할 수 있다. (편의상 하나의 파일에 mysql, postgres의 내용을 모두 포함하였다.)

```yml
version: "3.7"
volumes:
  mysql-volume: {}
  postgres-volume: {}

services:
  mysql-db:
    image: mysql:5.7
    environment:
      - MYSQL_ROOT_PASSWORD=test
      - MYSQL_MULTIPLE_DATABASES=test_db1,test_db2
      - MYSQL_USER=test
      - MYSQL_PASSWORD=test
    ports:
      - "127.0.0.1:3306:3306"
    volumes:
      - ./initialize_mysql_multiple_databases.sh:/docker-entrypoint-initdb.d/initialize_mysql_multiple_databases.sh
      - mysql-volume:/var/lib/mysql

  postgres-db:
    image: postgres
    environment:
      - POSTGRES_MULTIPLE_DB=test_db1,test_db2
      - POSTGRES_USER=test
      - POSTGRES_PASSWORD=test
      - POSTGRES_INITDB_ARGS=--encoding=UTF-8
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - ./initialize_postgresql_multiple_databases.sh:/docker-entrypoint-initdb.d/initialize_postgresql_multiple_databases.sh
      - postgres-volume:/var/lib/postgresql/data
```

마찬가지로 아래와 같은 명령어로 Database 생성 여부를 확인해볼 수 있다. 

```bash
$ docker-compose exec mysql-db mysql -u test -p
Enter password:

Welcome to the MySQL monitor.  Commands end with ; or \g.
Your MySQL connection id is 2
Server version: 5.7.28 MySQL Community Server (GPL)

Copyright (c) 2000, 2019, Oracle and/or its affiliates. All rights reserved.

Oracle is a registered trademark of Oracle Corporation and/or its
affiliates. Other names may be trademarks of their respective
owners.

Type 'help;' or '\h' for help. Type '\c' to clear the current input statement.

mysql> show databases;
+--------------------+
| Database           |
+--------------------+
| information_schema |
| test_db1           |
| test_db2           |
+--------------------+
3 rows in set (0.00 sec)
```

```bash
docker-compose exec postgres-db psql --username test --password
Password:

psql (12.0 (Debian 12.0-2.pgdg100+1))
Type "help" for help.

test=# \l
                             List of databases
   Name    | Owner | Encoding |  Collate   |   Ctype    | Access privileges
-----------+-------+----------+------------+------------+-------------------
 postgres  | test  | UTF8     | en_US.utf8 | en_US.utf8 |
 template0 | test  | UTF8     | en_US.utf8 | en_US.utf8 | =c/test          +
           |       |          |            |            | test=CTc/test
 template1 | test  | UTF8     | en_US.utf8 | en_US.utf8 | =c/test          +
           |       |          |            |            | test=CTc/test
 test      | test  | UTF8     | en_US.utf8 | en_US.utf8 |
 test_db1  | test  | UTF8     | en_US.utf8 | en_US.utf8 | =Tc/test         +
           |       |          |            |            | test=CTc/test
 test_db2  | test  | UTF8     | en_US.utf8 | en_US.utf8 | =Tc/test         +
           |       |          |            |            | test=CTc/test
(6 rows)
```





[dockermysql]: (https://hub.docker.com/_/mysql)
[dockerpostgresql]: (https://hub.docker.com/_/postgres)